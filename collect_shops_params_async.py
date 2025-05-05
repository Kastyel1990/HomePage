import sys
import mysql.connector
import paramiko
from ping3 import ping
import pyodbc
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
import logging
import time

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Конфигурации баз данных
SQL_SERVER_CONFIG = {
    "driver": "{ODBC Driver 18 for SQL Server}",
    "server": "192.168.2.59",
    "database": "OTData",
    "uid": "sa",
    "pwd": "Sql0412755",
    "Encrypt": "no",
    "TrustServerCertificate": "yes"
}

MYSQL_CONFIG = {
    'host': '192.168.2.50',
    'user': 'root',
    'password': 'arhistratig',
    'database': 'guacamole',
    'auth_plugin': 'mysql_native_password'
}

# Кэш для паролей касс
kassa_password_cache = {}

@contextmanager
def db_connection(db_type, config=None):
    if db_type == 'mysql':
        conn = mysql.connector.connect(**MYSQL_CONFIG)
    elif db_type == 'sqlserver':
        conn = pyodbc.connect(**SQL_SERVER_CONFIG)
    try:
        yield conn
    finally:
        conn.close()

def check_ip_availability(ip):
    return ping(ip, timeout=1) is not None

def get_kassa_password(shop):
    if shop in kassa_password_cache:
        return kassa_password_cache[shop]
    
    with db_connection('sqlserver') as conn:
        cursor = conn.cursor()
        cursor.execute(f"EXEC dbo.pr_GetKassaPassword @shop = '{shop}'")
        row = cursor.fetchone()
        if row:
            kassa_password_cache[shop] = row[3]
            return row[3]
    return ""

def convert_uptime_string(uptime):
    translations = {
        'day': ('день', 'дня', 'дней'),
        'hour': ('час', 'часа', 'часов'),
        'minute': ('минута', 'минуты', 'минут')
    }

    def choose_plural(number, forms):
        if 10 <= number % 100 <= 20:
            return forms[2]
        return forms[0] if number % 10 == 1 else forms[1] if 2 <= number % 10 <= 4 else forms[2]

    matches = re.findall(r'(\d+)\s*(day|hour|minute)s?', uptime.replace('up', '').strip())
    return ', '.join(
        f'{num} {choose_plural(int(num), translations[unit])}' 
        for num, unit in matches
    )

def process_host(row, client):
    result = {
        "type_os": "", "uptime": "", "cpu": "", "gpu": "",
        "mem": "", "mem_ubuntu": "", "constants": "", "cash_pass": "", "ip_fn": ""
    }
    
    if not check_ip_availability(row[2]):
        return None

    try:
        client.connect(hostname=row[2], username=row[3], password=row[4], timeout=10)
        commands = {
            "type_os": "cat /etc/*release | grep -m1 'PRETTY_NAME=' | cut -d'\"' -f2",
            "uptime": "uptime -p",
            "cpu": "cat /proc/cpuinfo | grep -m1 'model name' | cut -d':' -f2 | xargs",
            "gpu": "lspci | grep -m1 'VGA' | cut -d':' -f3 | xargs",
            "mem": "free -m | awk '/Mem:/ {printf \"%sMB / %sMB\", $2, $4}'",
            "mem_ubuntu": "free -m | awk '/Память:/ {printf \"%sMB / %sMB\", $2, $4}'",
            "constants": "psql -U postgres -d Cash_Place -t -c \"SELECT case when system_taxation = 1 then 'ОСН' when system_taxation = 2 then 'УСН ' else 'УСН + Патент ' end || ' | ' || 'Версия_ФН: ' || cast(version_fn as varchar(10)) || ' | ' || case when printing_using_libraries = true then 'Прямая_печать |' else 'Непрямая_печать | ' end || case when enable_cdn_markers = true then 'CDN_включен | ' else 'CDN_выключен | ' end FROM constants;\" | tr -d '[:space:]';echo",
            "ip_fn": "psql -U postgres -d Cash_Place -t -c \"SELECT case when variant_connect_fn = 1 then fn_ipaddr else null end FROM constants;\" | tr -d '[:space:]';echo"
        }

        for key, cmd in commands.items():
            _, stdout, _ = client.exec_command(cmd)
            result[key] = stdout.read().decode().strip().strip('"')

        result["cash_pass"] = get_kassa_password(row[0])
        result["uptime"] = convert_uptime_string(result["uptime"])
        result["ram"] = result["mem"] or result["mem_ubuntu"]

        return (
            row[0], row[1],
            result["type_os"],
            result["uptime"],
            result["cpu"],
            result["gpu"],
            result["ram"],
            result["constants"],
            result["cash_pass"],
            result["ip_fn"]
        )
    except Exception as e:
        logger.error(f"Error processing {row[2]}: {str(e)}")
        return None
    finally:
        client.close()

def get_params_pc(shop_name = None):
    start_time = time.time()
    update_data = []
    
    with db_connection('mysql') as conn:
        cursor = conn.cursor(buffered=True)
        sql = """
            SELECT sp.shop_name, sp.pc, gssp.ip, gssp.user, gssp.pass 
            FROM shops_params sp
            JOIN get_shops_ssh_params gssp 
            ON sp.shop_name = gssp.shop AND sp.pc = gssp.pc
        """
        if shop_name:
            sql += "\nWHERE sp.shop_name = %s\n"
            cursor.execute(sql, (shop_name,))
        else:
            cursor.execute(sql)

        rows = cursor.fetchall()

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = []
        for row in rows:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            futures.append(executor.submit(process_host, row, client))

        for future in as_completed(futures):
            data = future.result()
            if data:
                update_data.append(data)

    if update_data:
        with db_connection('mysql') as conn:
            cursor = conn.cursor()
            update_query = """
                UPDATE shops_params 
                SET
                    type_os = %s,
                    uptime = %s,
                    cpu_model = %s,
                    gpu_model = %s,
                    ram = %s,
                    constants = %s,
                    cash_pass = %s,
                    ip_fn = %s
                WHERE shop_name = %s AND pc = %s
            """
            # Переупорядочиваем данные для соответствия SQL-запросу
            reordered_data = [
                (
                    type_os, uptime + ' ± 1 час', cpu, gpu, ram, constants, cash_pass, ip_fn,  # Значения для SET
                    shop_name, pc  # Условия WHERE
                )
                for shop_name, pc, type_os, uptime, cpu, gpu, ram, constants, cash_pass, ip_fn in update_data
            ]
            cursor.executemany(update_query, reordered_data)
            conn.commit()
            logger.info(f"Updated {cursor.rowcount} records")
            end_time = time.time()

            total_time = end_time - start_time

            # Преобразуем время в минуты и секунды
            minutes = int(total_time // 60)
            seconds = int(total_time % 60)

            # Форматируем вывод
            if minutes > 0:
                logger.info(f"Общее время выполнения скрипта: {minutes} минут {seconds} секунд")
            else:
                logger.info(f"Общее время выполнения скрипта: {seconds} секунд")


if __name__ == '__main__':
    shop_name = sys.argv[1] if len(sys.argv) > 1 else None
    get_params_pc(shop_name)
