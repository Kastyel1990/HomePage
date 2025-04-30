import mysql.connector
import paramiko
from ping3 import ping
import pyodbc
import re

# Функция для проверки доступности IP-адреса
def check_ip_availability(ip):
    return ping(ip, timeout=1) is not None

# Функция получения пароля для кассы
def get_kassa_password(shop):
    conn_str = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=192.168.2.59;"
    "DATABASE=OTData;"
    "UID=sa;"
    "PWD=Sql0412755;"
    "Encrypt=no;TrustServerCertificate=yes;"
    )
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    cursor.execute(f"EXEC dbo.pr_GetKassaPassword @shop = '{shop}'")
    row = cursor.fetchone()
    #conn.close()
    #cursor.close()
    return row[3]

# Функция преобразования и перевод строки аптайма
def convert_uptime_string(uptime):
    # Словарь для перевода на русский
    translations = {
        'day': ('день', 'дня', 'дней'),
        'hour': ('час', 'часа', 'часов'),
        'minute': ('минута', 'минуты', 'минут')
    }

    # Функция для выбора правильной формы слова
    def choose_plural_form(number, forms):
        if 10 <= number % 100 <= 20:
            return forms[2]
        else:
            return forms[0] if number % 10 == 1 else forms[1] if number % 10 in [2, 3, 4] else forms[2]

    # Убираем слово 'up'
    uptime = uptime.replace('up', '').strip()

    # Регулярное выражение для поиска чисел и слов
    matches = re.findall(r'(\d+)\s*(day|hour|minute)s?', uptime)

    # Преобразуем каждую найденную пару
    result_parts = []
    for number_str, unit in matches:
        number = int(number_str)
        if unit in translations:
            translated_unit = choose_plural_form(number, translations[unit])
            result_parts.append(f'{number} {translated_unit}')

    # Собираем и возвращаем результат
    return ', '.join(result_parts)

# Функция получения параметров подключения к хосту
def get_params_pc():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(buffered=True)
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    cursor.execute("""
        SELECT sp.shop_name, sp.pc, gssp.ip, gssp.`user`, gssp.pass  from shops_params sp 
        join get_shops_ssh_params gssp on sp.shop_name = gssp.shop and sp.pc = gssp.pc;
    """)

    rows = cursor.fetchall()

    result = {
        "type_os": "",
        "uptime": "",
        "cpu": "",
        "gpu": "",
        "mem": "",
        "mem_ubuntu": "",
        "constants": "",
        "cash_pass": ""
        }

    #update_sql = []

    try:
        for row in rows:
            #if row[2] != '10.19.30.101':
                #continue

            status = check_ip_availability(row[2])
            if status:
                try:
                    client.connect(hostname=row[2], username=row[3], password=row[4], timeout=10)
                    # Формируем одну команду для выполнения всех команд одновременно
                    commands = {
                        "type_os": "cat /etc/*release | grep 'PRETTY_NAME=' | cut -d '=' -f2",
                        "uptime": "uptime -p",
                        "cpu": "cat /proc/cpuinfo | grep 'model name' | uniq | cut -d ':' -f2",
                        "gpu": "lspci | grep ' VGA ' | cut -d ':' -f3",
                        "mem": "free -m | awk '/Mem:/ {print $2 \"MB / \" $4 \"MB\"}'",
                        "mem_ubuntu": "free -m | awk '/Память:/ {print $2 \"MB / \" $4 \"MB\"}'",
                        "constants": "psql -U postgres -d Cash_Place -t -c \"SELECT case when system_taxation = 1 then 'ОСН' when system_taxation = 2 then 'УСН ' else 'УСН + Патент ' end || ' | ' || 'Версия_ФН: ' || cast(version_fn as varchar(10)) || ' | ' || case when printing_using_libraries = true then 'Прямая_печать |' else 'Непрямая_печать | ' end || case when enable_cdn_markers = true then 'CDN_включен | ' else 'CDN_выключен | ' end FROM constants;\" | tr -d '[:space:]';echo",
                    }

                    #########################################################################################
                    #c = "psql -U postgres -d Cash_Place -t -c \"UPDATE constants SET acquiring_bank = 1 WHERE id_acquirer_terminal IS NOT NULL AND id_acquirer_terminal <> '' AND ip_address_acquiring_terminal IS NOT NULL AND ip_address_acquiring_terminal <> '';\" | tr -d '[:space:]';echo"
                    #stdin, stdout, stderr = client.exec_command(c)
                    #########################################################################################

                    for command in commands:
                        stdin, stdout, stderr = client.exec_command(commands[command])
                        result[command] = stdout.read().decode().strip().strip('"')

                    result["cash_pass"] = get_kassa_password(row[0])

                    update_sql = f""" 
                        UPDATE shops_params 
                        SET type_os = '{result["type_os"]}',
	                        uptime = '{convert_uptime_string(result["uptime"])}',
	                        cpu_model = '{result["cpu"]}',
	                        gpu_model = '{result["gpu"]}',
	                        ram = '{result["mem"] if result["mem_ubuntu"] == '' else result["mem_ubuntu"]}',
	                        constants = '{result["constants"]}',
	                        cash_pass = '{result["cash_pass"]}'
                        where shop_name = '{row[0]}'
                        AND pc = '{row[1]}'
                    """
                    cursor.execute(update_sql)
                    conn.commit()
                    print('ip ' + row[2])
                except:
                    continue

        #if update_sql:
            #sql = " ; ".join(update_sql)
            
            
    finally:
        
        cursor.close()  # Закрываем курсор после обработки всех строк
        conn.close()
        client.close()        
                #command = " ; ".join(commands)
                #stdin, stdout, stderr = client.exec_command(command)
                #results = stdout.read().decode().splitlines()


# Конфигурация базы данных MySQL
db_config = {
    'host': '192.168.2.50',
    'user': 'root',
    'password': 'arhistratig',
    'database': 'guacamole',
    'auth_plugin': 'mysql_native_password'
}

if __name__ == '__main__':
    get_params_pc()