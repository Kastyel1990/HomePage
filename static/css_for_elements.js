
function set_css_for_picOS () {
    $('.picture_OS').each(function (index){
        //var $pic = $(this);
        var picId = 'PicOS' + index;
        //$pic.attr('id', picId);
        var style = `
            <style>
                #${picId}{
                    border: 0px solid #000000;
                    border-radius: 0px;
                    box-sizing: border-box;
                    padding: 0;
                    display: block;
                    width: 100%;
                    height: auto;
                    max-width: 519px;
                    margin-left: auto;
                    margin-right: auto;
                    vertical-align: top;
                    margin: 0;
                }
            </style>
        `;
        $('head').append(style);

    });
};

function set_css_for_buttons () {
    $('.buttonPC').each(function (index) {
        var $button = $(this);
        var ip = $button.data('label'); // Получаем IP из data-label
        var buttonId = 'ButtonPC' + index; // Генерируем уникальный ID для каждой кнопки
        //$button.attr('id', buttonId); // Устанавливаем уникальный ID


        // Устанавливаем инлайновые стили для псевдоэлемента ::after
        var style = `
           <style>
             #${buttonId}{
                position: relative;
                box-sizing: border-box;
                line-height: 21px;
                text-decoration: none;
                vertical-align: top;
                border: 1px solid #2E6DA4;
                border-radius: 4px;
                background-color: #3370B7;
                background-image: none;
                color: #FFFFFF;
                font-family: Arial;
                font-weight: normal;
                font-style: normal;
                font-size: 13px;
                padding: 1px 6px 1px 6px;
                text-align: center;
                -webkit-appearance: none;
                margin: 0;
             }
             #${buttonId}::after {
                 content: "${ip}";
                 position: absolute;
                 top: -7px;
                 right: -10px;
                 background-color: var(--label-background-color, #ff8400);
                 color: #FFFFFF;
                 font-size: 10px;
                 padding: 2px 5px;
                 border-radius: 5px;
             }
           </style>
       `;
        // Добавляем стили в <head>
        $('head').append(style);

    });
}