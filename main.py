
import io
from flask import Flask, render_template, jsonify, request, send_file, make_response, send_from_directory, session, redirect, url_for, flash, Response
from flask_sqlalchemy import SQLAlchemy
from ping3 import ping
from flask_apscheduler import APScheduler
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
#from threading import Thread
import base64
import paramiko
#import asyncio
import re
import pyodbc
import subprocess
import urllib.parse
import pandas as pd
import os
import uuid
import requests

# Клас настройки приложения Flask
class Config:
    #SCHEDULER_API_ENABLED = True
    SQLALCHEMY_DATABASE_URI = 'mysql://root:arhistratig@192.168.2.50/guacamole'

app = Flask(__name__)
#app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://root:arhistratig@192.168.2.50/guacamole'
app.config.from_object(Config())

# Инициализация шедулера
#scheduler = APScheduler()
#scheduler.init_app(app)
#scheduler.start()

# Конфигурация базы данных MySQL
db_config = {
    'host': '192.168.2.50',
    'user': 'root',
    'password': 'arhistratig',
    'database': 'guacamole',
    'auth_plugin': 'mysql_native_password'
}

# Функция, по добычи параметров PC и записи их в базу
# Запускает файл с определенной периодичностью
#def collect_shops_params():
#    # Здесь код для запуска другого Python файла
#    current_dir = Path(__file__).parent
#    relative_path = current_dir / 'collect_shops_params.py'
#    exec(open(relative_path).read())

#def collect_shops_params():
#    # Определение пути к файлу collect_shops_params.py
#    current_dir = Path(__file__).parent
#    relative_path = current_dir / 'collect_shops_params.py'
#    
#    # Запуск другого Python файла и перенаправление его вывода в основную консоль
#    process = subprocess.Popen(['python', str(relative_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
#
#    # Чтение и вывод сообщений из stdout и stderr
#    for line in process.stdout:
#        print(line, end='')
#
#    for line in process.stderr:
#        print(line, end='')
#
#    process.stdout.close()
#    process.stderr.close()
#    process.wait()

# Добавление задачи в планировщик
#scheduler.add_job(id='Collect_shops_params', func=collect_shops_params, trigger='interval', minutes=30)

TOKEN = ''
app.secret_key = 'my_secret'

# Настройка флага для регистрации
app.config['ALLOW_REGISTRATION'] = False  # По умолчанию регистрация разрешена

@app.context_processor
def inject_config():
    # Передаем переменную ALLOW_REGISTRATION во все шаблоны
    return dict(ALLOW_REGISTRATION=app.config.get('ALLOW_REGISTRATION', False))

#==============================================================================================
# Функции для обработки маршрутов 
#==============================================================================================

# Функция кодирования в base64 с поправками для guacamole
def encode_to_base64(input_str): 
    # Заменяем каждую точку на нулевой байт
    bytes_array = bytearray()
    for char in input_str:
        if char == '.':
            bytes_array.append(0)
        else:
            bytes_array.extend(char.encode('utf-8'))

    # Кодируем полученный массив байтов в base64
    return base64.b64encode(bytes_array).decode('utf-8').rstrip('=')

# Функция для получения словаря с городами, магазинами и ip из базы данных MySQL
# Не используется
def get_shops_array_OLD():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cities = {}
    cursor.execute("""
        SELECT sl.city as city, cg.connection_group_name as 'shop', 
                cg1.connection_group_name as 'pc',
                (select cp.parameter_value from guacamole_connection_parameter cp where cp.parameter_name = 'hostname' and cp.connection_id = c.connection_id  LIMIT 1) as 'ip',
                GROUP_CONCAT(c.connection_id)  as 'ids'
        FROM guacamole_connection_group cg
        JOIN guacamole_connection_group cg1 ON cg.connection_group_id = cg1.parent_id
        JOIN guacamole_connection c on c.parent_id = cg1.connection_group_id
        JOIN shops_locations sl on sl.group_id = cg.connection_group_id
        WHERE cg.connection_group_id > 3
        and city is not NULL 
        GROUP BY shop, pc, ip, city
        ORDER BY city, cg.connection_group_name, cg1.connection_group_name;
    """)
    for city, shop, pc, ip, ids in cursor:
        if city not in cities:
            cities[city] = {}
        if shop not in cities[city]:
            cities[city][shop] = []
        b64_parts = ids.split(',')
        b64_string = '.'.join([encode_to_base64(f'{part}.c.mysql') for part in b64_parts])
        cities[city][shop].append({'pc': pc, 'ip': ip, 'link': f'http://192.168.2.50/connection-tools/#/client/{b64_string}'})
    
    # Создаем словарь с городами, где каждый город содержит список кортежей магазинов и PC
    cities_shops_array = {city: [(shop, pcs) for shop, pcs in shops.items()] for city, shops in cities.items()}
    
    cursor.close()
    conn.close()
    return cities_shops_array

# Получить массив магазинов с шагом (Для разделения на три колонки)
# Не используется
def get_shops_array_with_step_OLD(start_index, step):
    shops_array = get_shops_array()  # Получаем исходный список магазинов
    # Фильтруем список, начиная с start_index и с шагом step
    filtered_shops_array = shops_array[start_index::step]
    return filtered_shops_array

# Функция для проверки доступности IP-адреса
def check_ip_availability(ip):
    return ping(ip, timeout=1) is not None

# Функция преобразования и перевод строки аптайма
# Не используется
def convert_uptime_string_OLD(uptime):
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

# Функция получения пароля для кассы
# Не используется
def get_kassa_password_OLD(shop):
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

# Функция для получения параметров подключения SSH для магазина и кассы
# Используется для отправки сообщений
def get_ssh_auth_params(shop, pc):
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT 
            (SELECT cp.parameter_value FROM guacamole_connection_parameter cp WHERE cp.connection_id = c.connection_id AND cp.parameter_name = 'hostname') AS ip,
            (SELECT cp.parameter_value FROM guacamole_connection_parameter cp WHERE cp.connection_id = c.connection_id AND cp.parameter_name = 'username') AS user,
            (SELECT cp.parameter_value FROM guacamole_connection_parameter cp WHERE cp.connection_id = c.connection_id AND cp.parameter_name = 'password') AS pass
        FROM guacamole_connection_group cg
        JOIN guacamole_connection_group cg1 ON cg.connection_group_id = cg1.parent_id
        JOIN guacamole_connection c ON cg1.connection_group_id = c.parent_id
        WHERE cg.connection_group_id > 3
        and cg.connection_group_name = '{shop}'
        and cg1.connection_group_name = '{pc}'
        AND LEFT(c.connection_name, 3) = 'SSH';
    """)

    row = cursor.fetchone()
    conn.close()
    cursor.close()
    
    # Проверяем, получены ли какие-либо данные
    if row:
        hostname, username, password = row
    else:
        hostname, username, password = '','',''
        
    return hostname, username, password

# Функция для подключения по ssh и возврата параметров ПК
# Не используется
def get_params_from_ssh_OLD(hostname, username, password, shop):
    params = [''] * 7  # Предварительно инициализируем список с пустыми строками
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=hostname, username=username, password=password, timeout=10)
        
        # Формируем одну команду для выполнения всех команд одновременно
        commands = [
            "cat /etc/*release | grep 'PRETTY_NAME=' | cut -d '=' -f2",
            "uptime -p",
            "cat /proc/cpuinfo | grep 'model name' | uniq | cut -d ':' -f2",
            "lspci | grep ' VGA ' | cut -d ':' -f3",
            "free -m | awk '/Mem:/ {print $2 \"MB / \" $4 \"MB\"}'",
            "psql -U postgres -d Cash_Place -t -c \"SELECT case when system_taxation = 1 then 'ОСН' when system_taxation = 2 then 'УСН ' else 'УСН + Патент ' end || ' | ' || 'Версия_ФН: ' || cast(version_fn as varchar(10)) || ' | ' || case when printing_using_libraries = true then 'Прямая_печать |' else 'Непрямая_печать | ' end || case when enable_cdn_markers = true then 'CDN_включен | ' else 'CDN_выключен | ' end FROM constants;\" | tr -d '[:space:]';echo",
            "echo ''"  # Это место для пароля кассы
        ]
        command = " ; ".join(commands)
        stdin, stdout, stderr = client.exec_command(command)
        results = stdout.read().decode().splitlines()
        
        if len(results) > 7:
            results[3] += ' | ' + results[4]
            del results[4]

        for i, result in enumerate(results):
            result = result.strip().strip('"')  # Предварительная обработка результата

            if i == 1:
                # Преобразование строки аптайма
                params[i] = convert_uptime_string(result)
            elif i == 6:
                # Получение пароля кассы
                params[i] = get_kassa_password(shop)
            else:
                # Для всех остальных случаев просто сохраняем результат
                params[i] = result

    except Exception as e:
        print(f"Ошибка при подключении к SSH: {e}")
    finally:
        client.close()
        return params

# Функция получения картинки на основе строки типа ОС
def get_pic_os(type_os, rdp_id):
    picoss = [
        'fedora',
        'kubuntu',
        'linux mint',
        'lubuntu',
        'simply',
        'ubuntu',
        'xubuntu',
        'debian'
    ]

    lower_string = type_os.lower()
    for pic in picoss:
        if pic in lower_string:
            return '/static/images/os-icons/' + pic + '.png'
    if rdp_id != '':
        return '/static/images/os-icons/windows.png'
    return '/static/images/logo1_small3.png'

# Меняем русские буквы в коде магазина для нормального поиска
def replace_rus_letters(text):
    rus_to_lat = {
        'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E',
        'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e'
    }
    return ''.join([rus_to_lat.get(c, c) for c in text])

#==============================================================================================
# Маршруты 
#==============================================================================================

# Декоратор для проверки авторизации
from functools import wraps

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
@login_required
def index():
    return render_template('index1.html')

@app.route('/auth-check')
def auth_check():
    if 'user_id' in session:
        return Response(status=200)
    else:
        return Response(status=401)

# @app.route('/')
# def index():

#     return render_template('index1.html')

###############################################################################################
#Иногда не работает
def send_message_OLD(shop, pc):
    message = request.form.get('message')  # Получаем сообщение из данных формы
    result = ''
    result_status = ''
    if message:
        hostname, username, password = get_ssh_auth_params(shop, pc)

        if (hostname, username, password != ''):
            #Проверяем доступность хоста
            status = check_ip_availability(hostname)
            if status:
                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                try:
                    client.connect(hostname=hostname, username=username, password=password, timeout=10)
                    
                    # Формируем одну команду для выполнения всех команд одновременно
                    #command = f"DISPLAY=:0 zenity --info --no-wrap --text='{message}'\n"
                    command = "zenity"
                    stdin, stdout, stderr = client.exec_command(command)

                    # Захватываем вывод и ошибки
                    stdout_str = stdout.read().decode('utf-8')
                    stderr_str = stderr.read().decode('utf-8')

                    if stderr_str:
                        result = f"Ошибка при выполнении команды: {stderr_str}"
                        result_status = 'error'
                    else:
                        result = 'Сообщение отправлено'
                        result_status = 'success'
                except Exception as e:
                    result = f"Ошибка при подключении к SSH: {e}"
                    result_status = 'error'
                    print(f"Ошибка при подключении к SSH: {e}")
                finally:
                    client.close()
            else:
                # Если хост недоступен
                result = f"Ошибка при подключении к SSH: Хост недоступен"
                result_status = 'error'
        else:
            # Если данных нет
            result = f"Ошибка при подключении к SSH: В базе не нашлось данных для подключения"
            result_status = 'error'
    else:
        #Если сообщение пустое
        result = "Ошибка при отправке сообщения: Сообщение пустое"
        result_status = 'error'
        
    return jsonify({'status': result_status, 'message': result})

# Маршрут отправки сообщения по ssh   
@app.route('/send_message/<shop>/<pc>', methods=['POST'])
def send_message(shop, pc):
    message = request.form.get('message')  # Получаем сообщение из данных формы
    result = ''
    result_status = ''
    if message:

        # Экранируем двойные кавычки в сообщении
        message = message.replace(' ', '\ ')

        hostname, username, password = get_ssh_auth_params(shop, pc)

        if hostname and username and password:
            # Проверяем доступность хоста
            status = check_ip_availability(hostname)
            if status:
                try:
                    # Формируем команду для выполнения через sshpass и ssh
                    command = f"DISPLAY=:0 zenity --info --no-wrap --text='{message}'"
                    ssh_command = f"sshpass -p {password} ssh -o StrictHostKeyChecking=no {username}@{hostname} {command}"
                    print(f"Executing command: {ssh_command}")
                    
                    # Выполняем команду
                    subprocess.Popen(ssh_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding="utf-8")
                    
                    result = 'Сообщение отправлено'
                    result_status = 'success'
                except Exception as e:
                    result = f"Ошибка при подключении к SSH: {e}"
                    result_status = 'error'
                    print(f"Ошибка при подключении к SSH: {e}")
            else:
                # Если хост недоступен
                result = "Ошибка при подключении к SSH: Хост недоступен"
                result_status = 'error'
        else:
            # Если данных нет
            result = "Ошибка при подключении к SSH: В базе не нашлось данных для подключения"
            result_status = 'error'
    else:
        # Если сообщение пустое
        result = "Ошибка при отправке сообщения: Сообщение пустое"
        result_status = 'error'
        
    return jsonify({'status': result_status, 'message': result})

# Маршрут получения параметров магазина(Тип ОС, аптайм, ЦП, ГП, память)
# Не используется
@app.route('/get_shop_parameters/<shop>/<pc>')
def get_shop_paremeters_OLD(shop, pc):
    # Проверяем, получены ли какие-либо данные
    hostname, username, password = get_ssh_auth_params(shop, pc)
    if (hostname, username, password != ''):
        #Проверяем доступность хоста
        status = check_ip_availability(hostname)
        if status:
            params = get_params_from_ssh(hostname, username, password, shop)
        else:
            # Если хост недоступен, создаем список из семи пустых строк
            params = [''] * 7    
    else:
        # Если данных нет, создаем список из семи пустых строк
        params = [''] * 7
    return jsonify(params)

# Маршрут для поиска магазинов по коду
@app.route('/search_shops/<search_text>')
def search_shops_for_code(search_text):
    search_text = urllib.parse.unquote(search_text)
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cursor.execute("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED")
    cursor.execute("START TRANSACTION")
    shops = {}
    
    query = """
    SELECT
	    cg.connection_group_name as shop,
	    CONCAT(IFNULL(sl.city, ''),
                          IFNULL(CONCAT(', ', sl.street), ''), 
                          IFNULL(CONCAT(', ', sl.house), ''), 
                          IFNULL(sl.appartments, '')) as adres,
	    cg1.connection_group_name as pc,
	    (SELECT cp.parameter_value FROM	guacamole_connection_parameter cp
	        WHERE cp.parameter_name = 'hostname'
		    AND cp.connection_id = c.connection_id
	        LIMIT 1
	    ) as ip,
	    IFNULL((SELECT c.connection_id from guacamole_connection c
	            where c.protocol = 'vnc'
		        and c.parent_id = cg1.connection_group_id
	            limit 1
    	), '') as vnc_id,
	    IFNULL((SELECT c.connection_id from guacamole_connection c
	            where c.protocol = 'ssh'
		        and c.parent_id = cg1.connection_group_id
	            limit 1
	    ), '') as ssh_id,
	    IFNULL((SELECT c.connection_id from guacamole_connection c
	            where c.protocol = 'rdp'
		        and c.parent_id = cg1.connection_group_id
	            limit 1
	    ), '') as rdp_id,
	    IFNULL(sp.type_os, '') as type_os,
	    IFNULL(sp.uptime, '') as uptime,
	    IFNULL(sp.cpu_model, '') as cpu_model,
	    IFNULL(sp.gpu_model, '') as gpu_model,
	    IFNULL(sp.ram, '') as ram,
	    IFNULL(sp.constants, '') as constants,
	    IFNULL(sp.cash_pass, '') as cash_pass
	    
    FROM guacamole_connection_group cg
    JOIN guacamole_connection_group cg1 ON cg.connection_group_id = cg1.parent_id
    JOIN guacamole_connection c on  c.parent_id = cg1.connection_group_id
    JOIN shops_locations_new sl on sl.code_shop = cg.connection_group_name
    JOIN shops_params sp on cg.connection_group_name = sp.shop_name and cg1.connection_group_name = sp.pc 
    WHERE cg.connection_group_id > 3
    """

    if re.search(r'\d', search_text):
        transformed_search = replace_rus_letters(search_text.strip()).upper()
        query += f"AND cg.connection_group_name LIKE '%{transformed_search}%' "
    else:
        query += f"AND sl.city = '{search_text}' "
        
    
    query += """
        GROUP BY shop, adres, pc, ip, vnc_id, ssh_id, rdp_id, type_os, uptime, cpu_model, gpu_model, ram, constants, cash_pass
    #ORDER BY cg.connection_group_name, cg1.connection_group_name;
    """

    # Используйте параметризованный запрос для предотвращения SQL-инъекций
    #search_string = f'%{search_text}%' if re.search(r'\d', search_text) else search_text
    print(query)
    cursor.execute(query)
    
    rows = cursor.fetchall()

    #for shop, adres, pc, ip, vnc_id, ssh_id, rdp_id, type_os, uptime, cpu_model, gpu_model, ram, constants, cash_pass in rows:
    #    if shop not in shops:
    #        shops[shop] = {'adres': adres, 'pcs': []}
    #    b64_string_vnc = encode_to_base64(f'{vnc_id}.c.mysql')
    #    b64_string_ssh = encode_to_base64(f'{ssh_id}.c.mysql')
    #    b64_string_rdp = '' if rdp_id == '' else encode_to_base64(f'{rdp_id}.c.mysql')
    #    #b64_parts = ids.split(',')
    #    #b64_string = '.'.join([encode_to_base64(f'{part}.c.mysql') for part in b64_parts])
    #    shops[shop]['pcs'].append({'pc': pc, 'ip': ip, 
    #                               'vnc_link': f'http://192.168.2.50:8080/#/client/{b64_string_vnc}',
    #                               'ssh_link': f'http://192.168.2.50:8080/#/client/{b64_string_ssh}',
    #                               'rdp_link': '' if b64_string_rdp == '' else f'http://192.168.2.50:8080/#/client/{b64_string_rdp}',
    #                               'type_os': type_os, 
    #                               'uptime': uptime,
    #                               'cpu_model': cpu_model,
    #                               'gpu_model': gpu_model, 
    #                               'ram': ram, 
    #                               'constants': constants, 
    #                               'cash_pass': cash_pass,
    #                               'pic_os': get_pic_os(type_os, rdp_id),
    #                               'status': check_ip_availability(ip)
    #                               })
    #
    ## Создаем список словарей для JSON
    #shops_list = [{'shop': shop, 'adres': info['adres'], 'pcs': info['pcs']} for shop, info in shops.items()]
    #########################################################################################################
    def process_row(shop, adres, pc, ip, vnc_id, ssh_id, rdp_id, type_os, uptime, cpu_model, gpu_model, ram, constants, cash_pass):
        if shop not in shops:
            shops[shop] = {'adres': adres, 'pcs': []}
            
        b64_string_vnc = encode_to_base64(f'{vnc_id}.c.mysql')
        b64_string_ssh = encode_to_base64(f'{ssh_id}.c.mysql')
        b64_string_rdp = '' if rdp_id == '' else encode_to_base64(f'{rdp_id}.c.mysql')
        #b64_parts = ids.split(',')
        #b64_string = '.'.join([encode_to_base64(f'{part}.c.mysql') for part in b64_parts])
            
        # Возвращаем результаты для дальнейшей обработки
        return {
            'shop': shop,
            'adres': adres,
            'pc': pc, 'ip': ip, 
            'vnc_link': f'http://192.168.2.50/connection-tools/#/client/{b64_string_vnc}',
            'ssh_link': f'http://192.168.2.50/connection-tools/#/client/{b64_string_ssh}',
            'rdp_link': '' if b64_string_rdp == '' else f'http://192.168.2.50/connection-tools/#/client/{b64_string_rdp}',
            'type_os': type_os, 
            'uptime': uptime,
            'cpu_model': cpu_model,
            'gpu_model': gpu_model, 
            'ram': ram, 
            'constants': constants, 
            'cash_pass': cash_pass,
            'pic_os': get_pic_os(type_os, rdp_id),
            'status': check_ip_availability(ip)
    }
    
    # Используем ThreadPoolExecutor для мультипоточной обработки
    with ThreadPoolExecutor(max_workers=10) as executor:
        # Отправляем задачи на выполнение
        future_to_row = {executor.submit(process_row, *row): row for row in rows}
#
        for future in as_completed(future_to_row):
            result = future.result()
            shop = result['shop']
            if shop not in shops:
                shops[shop] = {'adres': result['adres'], 'pcs': []}
            # Добавляем информацию о PC в словарь shops
            shops[shop]['pcs'].append({
                'pc': result['pc'],
                'ip': result['ip'],
                'vnc_link': result['vnc_link'],
                'ssh_link': result['ssh_link'],
                'rdp_link': result['rdp_link'],
                'type_os': result['type_os'], 
                'uptime': result['uptime'],
                'cpu_model': result['cpu_model'],
                'gpu_model': result['gpu_model'], 
                'ram': result['ram'], 
                'constants': result['constants'], 
                'cash_pass': result['cash_pass'],
                'pic_os': result['pic_os'],
                'status': result['status']
            })
#
    # После цикла формируем список для JSON
    shops_list = [{'shop': shop, 'adres': info['adres'], 'pcs': info['pcs']} for shop, info in shops.items()]
    
    # Сортировка списка магазинов по ключу 'shop'
    shops_list = sorted(shops_list, key=lambda x: x['shop'])

    # Сортировка списка ПК в каждом магазине по ключу 'pc'
    for shop in shops_list:
        shop['pcs'] = sorted(shop['pcs'], key=lambda x: x['pc'])
    
    #########################################################################################################


    cursor.execute("COMMIT")
    cursor.close()
    conn.close()
    return jsonify(shops_list)

# Маршрут для получения списка городов
@app.route('/get_cities/')
def get_cities():
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cities = []
    cursor.execute("""
        SELECT distinct sl.city as city
        FROM shops_locations_new sl
        WHERE city is not NULL 
        ORDER BY city;
    """)
    cities=[city[0] for city in cursor]
    cursor.close()
    conn.close()
    return jsonify(cities)

# Маршрут для проверки доступности хоста
@app.route('/check_ip/<ip>')
def check_ip(ip):
    status = check_ip_availability(ip)
    return jsonify({'ip': ip, 'status': status})

# Маршрут для получения картинок ОС
# Не используется
@app.route('/get_picos/<shop>/<pc>')
def get_picOS_OLD(shop, pc):
    picoss = [
        'fedora',
        'kubuntu',
        'linux mint',
        'lubuntu',
        'simply',
        'ubuntu',
        'xubuntu',
        'debian'
    ]
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT 
            (SELECT cp.parameter_value FROM guacamole_connection_parameter cp WHERE cp.connection_id = c.connection_id AND cp.parameter_name = 'hostname') AS ip,
            (SELECT cp.parameter_value FROM guacamole_connection_parameter cp WHERE cp.connection_id = c.connection_id AND cp.parameter_name = 'username') AS user,
            (SELECT cp.parameter_value FROM guacamole_connection_parameter cp WHERE cp.connection_id = c.connection_id AND cp.parameter_name = 'password') AS pass
        FROM guacamole_connection_group cg
        JOIN guacamole_connection_group cg1 ON cg.connection_group_id = cg1.parent_id
        JOIN guacamole_connection c ON cg1.connection_group_id = c.parent_id
        WHERE cg.connection_group_id > 3
        and cg.connection_group_name = '{shop}'
        and cg1.connection_group_name = '{pc}'
        AND LEFT(c.connection_name, 3) = 'SSH';
    """)

    row = cursor.fetchone()
    conn.close()
    cursor.close()
    
    picos = ''
    # Проверяем, получены ли какие-либо данные
    if row:
        hostname, username, password = row

        #Проверяем доступность хоста
        status = check_ip_availability(hostname)
        if status:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            result = ''
            try:
                client.connect(hostname=hostname, username=username, password=password, timeout=10)
        
                # Формируем одну команду для выполнения всех команд одновременно
                command = "cat /etc/*release | grep 'PRETTY_NAME=' | cut -d '=' -f2"
                stdin, stdout, stderr = client.exec_command(command)
                results = stdout.read().decode().splitlines()
                result = results[0].strip().strip('"')  # Предварительная обработка результата
                result = result.lower()
                
                for pic in picoss:
                    if pic in result:
                        picos =  jsonify('/static/images/os-icons/' + pic + '.png')
            except Exception as e:
                print(f"Ошибка при подключении к SSH: {e}")
                picos = jsonify('/static/images/logo1_small3.png')
            finally:
                client.close()
                return picos
        else:
            return jsonify('/static/images/logo1_small3.png')
    else:
        # Если данных нет, создаем список из семи пустых строк
        return jsonify('/static/images/os-icons/windows.png')

# Папка для временных файлов
UPLOAD_FOLDER = '/home/ch/uploads_for_ai'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/select_mssql_script', methods=['POST'])
def select_mssql_script():
    script = request.get_json()['script']
    if 'SELECT' in script and \
    'ALTER' not in script and \
    'CREATE' not in script and \
    'INSERT' not in script and \
    'UPDATE' not in script:
        conn_str = (
            "DRIVER={ODBC Driver 18 for SQL Server};"
            "SERVER=192.168.2.59;"
            "DATABASE=cash_exchange;"
            "UID=sa;"
            "PWD=Sql0412755;"
            "Encrypt=no;TrustServerCertificate=yes;"
        )
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute(script)
        columns = [column[0] for column in cursor.description]  # Получаем названия колонок
        #rows = [dict(zip(columns, row)) for row in cursor.fetchall()]  # Преобразуем в список словарей
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        # Преобразование в DataFrame
        df = pd.DataFrame.from_records(rows, columns=columns)

        # Проверка на количество строк и столбцов
        if len(df) > 3 or len(columns) > 2:
            # Генерация уникального имени файла
            file_id = str(uuid.uuid4())
            file_name = f"{file_id}.xlsx"
            file_path = os.path.join(UPLOAD_FOLDER, file_name)
            
            # Сохранение Excel-файла на сервере
            with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                df.to_excel(writer, index=False)
            
            # Формирование URL для скачивания
            download_url = f"http://192.168.2.50/uploads/{file_name}"
            
            # Возвращаем URL для скачивания
            return jsonify({
                "message": "File generated successfully",
                "download_url": download_url
            })
        
        return jsonify([dict(zip(columns, row)) for row in rows]) #jsonify(rows)
    else:
        return None
    
# Маршрут для скачивания файлов
@app.route('/uploads/<filename>', methods=['GET'])
def download_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

@app.route('/get_token', methods=['GET'])
def get_token():
    try:
        url = "http://192.168.2.50/connection-tools/api/tokens/"

        payload='username=ch&password=Kastyel1990'
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        response = requests.request("POST", url, headers=headers, data=payload)
        token = response.json().get("authToken")
        if not token:
            return jsonify({"error": "Токен не получен"}), 500

        return jsonify({"token": token})
    except requests.RequestException as e:
        return jsonify({"error": f"Ошибка при запросе токена: {str(e)}"}), 500
    
# Маршрут для временного подклюячения
@app.route('/quick_connect', methods=['POST'])
def quick_connect():
    token = request.form['token']
    protocol = request.form['protocol']
    ip = request.form['ip']
    username = request.form['username']
    password = request.form['password']

    base_url = "http://192.168.2.50/connection-tools/api"

    port = 5900 if protocol == 'vnc' else 22 if protocol == 'ssh' else 3389
    
    # Создай временное подключение через QuickConnect
    quickconnect_data = f"uri={protocol}://{username}:{password}@{ip}:{port}"

    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    response = requests.post(
        f"{base_url}/session/ext/quickconnect/create?token={token}",
        data=quickconnect_data,
        headers=headers
    )
    connection_id = response.json()["identifier"]
    #b64_string = encode_to_base64(f'{connection_id}.c.quickconnect').rstrip('=')
    guac_id = f"{connection_id}.c.quickconnect"
    b64_string = encode_to_base64(guac_id)
    return f"http://192.168.2.50/connection-tools/#/client/{b64_string}?token={token}"

    
@app.route('/toggle_registration')
def toggle_registration():
    # Маршрут для переключения возможности регистрации
    app.config['ALLOW_REGISTRATION'] = not app.config['ALLOW_REGISTRATION']
    flash(f"Регистрация {'включена' if app.config['ALLOW_REGISTRATION'] else 'выключена'}")
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            return redirect(url_for('index'))
        else:
            flash('Неверные учетные данные')
            return redirect(url_for('login'))
    
    return render_template('login.html')

# Маршрут для выхода
@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('login'))

# Маршрут для регистрации
@app.route('/register', methods=['GET', 'POST'])
def register():
    if not app.config['ALLOW_REGISTRATION']:
        return "Регистрация временно отключена", 403
    
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        if password != confirm_password:
            flash('Пароли не совпадают')
            return redirect(url_for('register'))
        
        hashed_password = generate_password_hash(password)
        
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                flash('Пользователь уже существует')
                return redirect(url_for('register'))
            
            cursor.execute(
                "INSERT INTO users (username, password_hash) VALUES (%s, %s)",
                (username, hashed_password)
            )
            conn.commit()
        finally:
            conn.close()
        
        flash('Регистрация успешна! Теперь вы можете войти.')
        return redirect(url_for('login'))
    
    return render_template('register.html')

# Маршрут для обновления информации по конкретному магазину
@app.route('/update_shop/<shop_name>', methods=['POST'])
def update_shop(shop_name):
    """
    Маршрут для обновления данных только по одному магазину.
    shop_name — идентификатор магазина (имя или номер).
    """
    
    # Запускаем скрипт с параметром
    result = subprocess.run(['python', str(Path(__file__).parent / 'collect_shops_params_async.py'), shop_name])
    
    # Можно добавить обработку ошибок/вывода
    return jsonify({'status': 'ok' if result.returncode == 0 else 'error'})

if __name__ == '__main__':
    app.run(port=9000,host='127.0.0.1',)
    #app.run(port=9002,host='0.0.0.0',)
