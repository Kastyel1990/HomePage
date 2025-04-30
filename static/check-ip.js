function check_ip() {
    $('.buttonPCVNC').each(function (index) {
        var $button = $(this);
        var ip = $button.data('label'); // Получаем IP из data-label
        //var buttonId = 'ButtonPC' + index; // Генерируем уникальный ID для каждой кнопки
        //$button.attr('id', buttonId); // Устанавливаем уникальный ID

        $.getJSON('/check_ip/' + ip, function (data) {
            // Определяем цвет фона для надписи
            var labelColor = data.status ? '#00bc00' : '#ff0000';

            // Применяем цвет фона к псевдоэлементу ::after
            $button.css('--label-background-color', labelColor);

            if(!data.status){
                document.getElementById('ButtonPCMsg' + index).classList.add('button-disabled');
                
                var button_rdp = document.getElementById('ButtonPCRDP' + index)
                if(button_rdp){
                    button_rdp.classList.add('button-disabled');
                };

                var button_ssh = document.getElementById('ButtonPCSSH' + index)
                if(button_ssh){
                    button_ssh.classList.add('button-disabled');
                };

                document.getElementById('ButtonPCVNC' + index).classList.add('button-disabled');
            }
        });
    });
};
