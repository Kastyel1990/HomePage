function getCitiesAndFillListView() {
    // Отправляем GET запрос на сервер для получения списка городов
    fetch('/get_cities/')
        .then(function(response) {
            // Проверяем, что запрос успешен
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json(); // Парсим ответ как JSON
        })
        .then(function(cities) {
            // Получаем список городов и заполняем ListView1
            var listView = document.getElementById('ListView1');
            listView.innerHTML = ''; // Очищаем текущий список

            cities.forEach(function(city) {
                var listItem = document.createElement('li');
                var link = document.createElement('a');
                link.href = '#'; // Установите правильный путь или функцию для обработки клика
                link.textContent = city; // Предполагается, что 'city' - это строка
                
                // Оберните вызов fetchShopsAndUpdateAccordion в анонимную функцию
                listItem.addEventListener('click', function(event) {
                    event.preventDefault(); // Предотвратить стандартное поведение ссылки
                    fetchShopsAndUpdateAccordion(city);
                });
                
                listItem.appendChild(link);
                listView.appendChild(listItem);
            });
            $("#ListView1").listview(
                {
                   inset: false
                });
        })
        .catch(function(error) {
            console.error('There has been a problem with your fetch operation:', error);
        });
}

// Вызываем функцию при загрузке страницы или по какому-либо событию
document.addEventListener('DOMContentLoaded', getCitiesAndFillListView);