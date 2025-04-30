
// Функция для обновления второго столбца таблицы
function updateTableColumn(shop, pc, table) {
    // Отправляем запрос к Flask-маршруту
    fetch(`/get_shop_parameters/${shop}/${pc}`)
        .then(response => response.json())
        .then(data => {
            // Получаем все строки таблицы
            var rows = table.getElementsByTagName('tr');

            // Перебираем строки и обновляем данные во втором столбце
            for (let i = 0; i < rows.length; i++) {
                // Получаем ячейку второго столбца
                var cell = rows[i].cells[1];
                // Обновляем текстовое содержимое ячейки
                var textValue = document.createTextNode(data[i]);
                // Очищаем текущее содержимое ячейки и добавляем новый текст
                cell.innerHTML = '';
                cell.appendChild(textValue);
            }
        })
        .catch(error => console.error('Error updating table:', error));
};

function update_picOS(shop, pc, pic) {
    fetch(`/get_picos/${shop}/${pc}`)
        .then(response => {
            // Проверяем, что ответ успешен (статус в диапазоне 200-299)
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Предполагаем, что 'data' содержит правильный URL изображения
            $(pic).attr('src', data);
        })
        .catch(error => {
            console.error('Error fetching the image:', error);
            // Здесь можно установить изображение по умолчанию в случае ошибки
            // например, pic.attr('src', 'path_to_default_image.png');
        });
};

function set_pic_os() {
    $('.picture_OS').each(function() {
        var pic = $(this);
        var shop = pic.attr('shop');
        var pc = pic.attr('pc');
        
        update_picOS(shop, pc, pic.get(0))
    });
};

function set_os_params() {
    // Пробегаемся по всем таблицам
    $('.table_params').each(function () {
        var table = $(this);

        // Извлекаем shop, pc из атрибутов
        var shop = table.attr('shop');
        var pc = table.attr('pc');
        var index_counter = table.attr('indexcounter');
        var button = $('#ButtonPC' + index_counter);
        var ip = button.data('label');

        updateTableColumn(shop, pc, table.get(0));
        //// Отправляем запрос для проверки доступности IP
        //$.getJSON('/check_ip/' + ip, function (data) {
        //    // Определяем цвет фона для надписи
        //    var status = data.status;
        //    var labelColor = status ? '#00bc00' : '#ff0000';
//
        //    // Применяем цвет фона к псевдоэлементу ::after
        //    button.css('--label-background-color', labelColor);
//
        //    // Если хост доступен, то заполняем таблицу
        //    if (status) {
        //        updateTableColumn(shop, pc, table.get(0)); // Обратите внимание на .get(0) для получения нативного DOM-элемента
        //    }
        //}).fail(function() {
        //    // Если запрос не удался, закрашиваем псевдоэлемент ::after в красный
        //    button.css('--label-background-color', '#ff0000');
        //});
    });
}