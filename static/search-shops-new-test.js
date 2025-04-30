document.addEventListener('DOMContentLoaded', function () {
    var editbox1 = document.getElementById('Editbox1');

    editbox1.addEventListener('focus', function () {
        if (this.value === 'Поиск по магазину') {
            this.value = '';
        }
    });

    editbox1.addEventListener('blur', function () {
        if (this.value === '') {
            this.value = 'Поиск по магазину';
        }
    });

    editbox1.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            if (this.value === '') {
                editbox1.blur();
            } else {
                fetchShopsAndUpdateAccordion(this.value);
                editbox1.value = '';
                editbox1.blur();
            }
        }
    });
});

function applyStyles(element, styles) {
    Object.keys(styles).forEach(key => {
        element.style[key] = styles[key];
    });
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

async function fetchShopsAndUpdateAccordion(searchText) {
    if (searchText.trim() !== '') {
        try {
            const shopsResponse = await fetch('/search_shops/' + searchText);
            const shops = await shopsResponse.json();
            createAccordions(shops);
            scrollToTop();
        } catch (error) {
            console.error('Error in fetchShopsAndUpdateAccordion:', error);
        }
    }
}

async function updateSingleAccordion(shopNumber, panel, index) {
    try {
        // Сохраняем состояние аккордеона
        const collapseElement = panel.find('.panel-collapse');
        const isOpen = collapseElement.hasClass('in');

        const response = await fetch('/search_shops/' + shopNumber);
        const shops = await response.json();
        const shopInfo = shops.find(s => s.shop === shopNumber);
        if (shopInfo) {
            createSingleAccordion(shopInfo, panel, index, isOpen);
        } else {
            alert('Магазин не найден');
        }
    } catch (error) {
        console.error('Ошибка при обновлении аккордеона:', error);
        alert('Ошибка обновления данных магазина');
    }
}

function createSingleAccordion(shopInfo, panel, index, isOpen = false) {
    var shop = shopInfo.shop;
    var adres = shopInfo.adres;
    var pcs = shopInfo.pcs;

    // Очищаем текущий аккордеон
    panel.empty();

    // Создаём заголовок аккордеона
    var panelHeading = $('<div>').addClass('panel-heading').attr({ 'role': 'tab' });
    var panelTitle = $('<h4>').addClass('panel-title');
    var panelLink = $('<a>').attr({
        'role': 'button',
        'data-toggle': 'collapse',
        'href': '#Accordion1-collapse' + index,
        'aria-controls': 'Accordion1-collapse' + index,
        'aria-expanded': isOpen ? 'true' : 'false'
    }).text(shop + ' | ' + adres);

    // Динамические стили для элементов заголовка
    applyStyles(panelHeading[0], {
        backgroundColor: '#F5F5F5',
        border: '1px solid #DDDDDD',
        padding: '8px 10px',
        cursor: 'pointer'
    });
    applyStyles(panelTitle[0], {
        margin: '0',
        fontFamily: 'Arial',
        fontSize: '14px',
        lineHeight: '1.2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    });
    applyStyles(panelLink[0], {
        display: 'block',
        width: '100%',
        textDecoration: 'none',
        color: '#000000'
    });

    panelLink.prepend($('<span>').addClass('panel-icon'));
    panelLink.prepend($('<i>').addClass('fa fa-window-restore accordion-icon'));

    // Добавляем кнопку обновления
    var refreshButton = $('<button>').addClass('refresh-button').attr({
        'title': 'Обновить данные магазина',
        'data-shop': shop
    }).append($('<i>').addClass('fa fa-refresh'));

    applyStyles(refreshButton[0], {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#3370B7',
        fontSize: '14px',
        cursor: 'pointer',
        padding: '0',
        lineHeight: '1'
    });

    refreshButton.on('click', function (e) {
        e.stopPropagation(); // Предотвращаем раскрытие аккордеона
        $(this).find('i').addClass('fa-spin');
        updateSingleAccordion(shop, panel, index).finally(() => {
            $(this).find('i').removeClass('fa-spin');
        });
    });

    panelLink.append(refreshButton);
    panelTitle.append(panelLink);
    panelHeading.append(panelTitle);
    panel.append(panelHeading);

    // Создаём тело аккордеона (без изменений из оригинала)
    var panelCollapse = $('<div>').attr({
        'id': 'Accordion1-collapse' + index,
        'class': 'panel-collapse collapse' + (isOpen ? ' in' : ''),
        'data-parent': '#Accordion1',
        'role': 'tabpanel'
    });
    var panelBody = $('<div>').addClass('panel-body');

    var index_counter = index * 1000;
    pcs.forEach((pcInfo) => {
        var labelColor = pcInfo.status ? '#00bc00' : '#ff0000';
        var indexItem = 4;
        var wb_LayoutGrid = $('<div>').attr({ 'id': 'wb_LayoutGrid' + indexItem });
        var layoutGrid = $('<div>').attr({ 'id': 'LayoutGrid' + indexItem });
        var col1 = $('<div>').addClass('col-1');
        var wb_Image = $('<div>').attr({ 'id': 'wb_PicOS' + index_counter });

        var image = $('<img>').attr({
            'indexCounter': index_counter,
            'src': pcInfo.pic_os,
            'id': 'PicOS' + index_counter,
            'width': '93',
            'height': '92'
        });
        image.addClass("picture_OS");
        image.attr({
            'shop': shop,
            'pc': pcInfo.pc
        });

        wb_Image.append(image);
        col1.append(wb_Image);
        layoutGrid.append(col1);

        var col2 = $('<div>').addClass('col-2');
        var buttonsContainer = $('<div>').css({
            'display': 'flex',
            'justify-content': 'space-between',
            'width': '100%',
            'gap': '10px'
        });

        if (pcInfo.rdp_link === '') {
            var buttonMsg = $('<a>').addClass('buttonPCMsg');
            buttonMsg.attr({
                'title': 'Отправка сообщения',
                'indexCounter': index_counter,
                'id': 'ButtonPCMsg' + index_counter,
                'data-label': pcInfo.ip,
                'href': 'javascript:void(0);',
                'style': 'display:block;width: 10%;height:25px;z-index:6;position:relative;text-decoration:none;'
            }).prepend($('<i>').addClass('fa fa-commenting-o accordion-icon').attr('style', 'position:relative;'));

            if (!pcInfo.status) {
                buttonMsg.addClass('button-disabled');
            }

            buttonsContainer.append(buttonMsg);

            buttonMsg.on('click', function () {
                $("#Dialog1").dialog({
                    title: 'Отправка сообщения',
                    modal: true,
                    width: 412,
                    height: 139,
                    position: { my: 'center', at: 'center', of: window },
                    resizable: true,
                    draggable: true,
                    closeOnEscape: true,
                    show: { effect: 'blind', duration: 400 },
                    hide: { effect: 'blind', duration: 400 },
                    autoOpen: true,
                    classes: { 'ui-dialog': 'Dialog1' }
                });
                $("#Dialog1").attr({ 'shop': shop, 'pc': pcInfo.pc });
            });
        }

        if (pcInfo.rdp_link === '') {
            var buttonSSH = $('<a>').addClass('buttonPCSSH');
            buttonSSH.attr({
                'title': 'Подключение по SSH',
                'indexCounter': index_counter,
                'id': 'ButtonPCSSH' + index_counter,
                'data-link': pcInfo.ssh_link,
                'data-label': pcInfo.ip,
                'href': 'javascript:void(0);',
                'style': 'display:block;width: 45%;height:25px;z-index:6;position:relative;text-decoration:none;'
            }).text('SSH_' + pcInfo.pc);

            if (!pcInfo.status) {
                buttonSSH.addClass('button-disabled');
            }

            buttonSSH.on('click', function () {
                if (!pcInfo.status) return;
                $.ajax({
                    url: '/get_token',
                    type: 'GET',
                    success: function (response) {
                        var token = response.token;
                        var url = pcInfo.ssh_link + '?token=' + token;
                        window.open(url, '_blank');
                    },
                    error: function () {
                        alert('Ошибка получения токена');
                    }
                });
            });

            buttonsContainer.append(buttonSSH);
        } else {
            var buttonRDP = $('<a>').addClass('buttonPCRDP');
            buttonRDP.attr({
                'title': 'Подключение по RDP',
                'indexCounter': index_counter,
                'id': 'ButtonPCRDP' + index_counter,
                'data-link': pcInfo.rdp_link,
                'data-label': pcInfo.ip,
                'href': 'javascript:void(0);',
                'style': 'display:block;width: 50%;height:25px;z-index:6;position:relative;text-decoration:none;'
            }).text('RDP_' + pcInfo.pc);

            if (!pcInfo.status) {
                buttonRDP.addClass('button-disabled');
            }

            buttonRDP.on('click', function () {
                if (!pcInfo.status) return;
                $.ajax({
                    url: '/get_token',
                    type: 'GET',
                    success: function (response) {
                        var token = response.token;
                        var url = pcInfo.rdp_link + '?token=' + token;
                        window.open(url, '_blank');
                    },
                    error: function () {
                        alert('Ошибка получения токена');
                    }
                });
            });

            buttonsContainer.append(buttonRDP);
        }

        var buttonVNC = $('<a>').addClass('buttonPCVNC');
        buttonVNC.attr({
            'title': 'Подключение по VNC',
            'indexCounter': index_counter,
            'id': 'ButtonPCVNC' + index_counter,
            'data-link': pcInfo.vnc_link,
            'data-label': pcInfo.ip,
            'href': 'javascript:void(0);'
        }).text('VNC_' + pcInfo.pc);
        if (pcInfo.rdp_link === '') {
            buttonVNC.attr({ 'style': 'display:block;width: 50%;height:25px;z-index:6;position:relative;text-decoration:none;' });
        } else {
            buttonVNC.attr({ 'style': 'display:block;width: 45%;height:25px;z-index:6;position:relative;text-decoration:none;' });
        }

        buttonVNC.css('--label-background-color', labelColor);
        if (!pcInfo.status) {
            buttonVNC.addClass('button-disabled');
        }

        buttonVNC.on('click', function () {
            if (!pcInfo.status) return;
            $.ajax({
                url: '/get_token',
                type: 'GET',
                success: function (response) {
                    var token = response.token;
                    var url = pcInfo.vnc_link + '?token=' + token;
                    window.open(url, '_blank');
                },
                error: function () {
                    alert('Ошибка получения токена');
                }
            });
        });

        buttonsContainer.append(buttonVNC);

        tableData = [
            { label: "Тип ОС:", value: pcInfo.type_os },
            { label: "Аптайм:", value: pcInfo.uptime },
            { label: "CPU:", value: pcInfo.cpu_model },
            { label: "GPU:", value: pcInfo.gpu_model.replace(/\n/g, "<br>") },
            { label: "Память:", value: pcInfo.ram },
            { label: "Константы:", value: pcInfo.constants },
            { label: "Пароль на кассу:", value: pcInfo.cash_pass },
        ];

        tableStyles = {
            border: "1px solid #C0C0C0",
            borderRadius: "0px",
            backgroundColor: "transparent",
            backgroundImage: "none",
            borderCollapse: "collapse",
            borderSpacing: "1px",
            margin: "0",
            width: "100%",
            height: "93px",
            display: "table",
            zIndex: "14"
        };

        cellStyles = {
            background: "transparent",
            border: "1px #C0C0C0 solid",
            textAlign: "left",
            verticalAlign: "top",
            color: "#000000",
            fontFamily: "Arial",
            fontSize: "13px",
            lineHeight: "16px"
        };

        pStyles = {
            margin: "0",
            padding: "0",
            whiteSpace: "nowrap"
        };

        table = document.createElement("table");
        table.className = "table_params";
        table.id = "Table" + index_counter;
        applyStyles(table, tableStyles);

        table.setAttribute('shop', shop);
        table.setAttribute('pc', pcInfo.pc);
        table.setAttribute('ip', pcInfo.ip);
        table.setAttribute('indexCounter', index_counter);

        tableData.forEach((item, index) => {
            row = table.insertRow();
            cell1 = row.insertCell(0);
            cell2 = row.insertCell(1);
            cell1.className = "cell0";
            cell2.className = "cell0";
            cell1.innerHTML = `<p>${item.label}</p>`;
            cell2.innerHTML = `<p>${item.value}</p>`;
            cell2.setAttribute('data-index', index);

            applyStyles(cell1, cellStyles);
            applyStyles(cell2, cellStyles);

            pElements = row.querySelectorAll('p');
            pElements.forEach(p => {
                applyStyles(p, pStyles);
            });
        });

        col2.append(buttonsContainer);
        col2.append(table);
        layoutGrid.append(col2);
        wb_LayoutGrid.append(layoutGrid);
        panelBody.append(wb_LayoutGrid);

        index_counter += 1;
    });

    panelCollapse.append(panelBody);
    panel.append(panelCollapse);

    // Обновляем события collapse
    $("#Accordion1 .panel").off('show.bs.collapse hide.bs.collapse');
    $("#Accordion1 .panel").on('show.bs.collapse', function () {
        $(this).addClass('active');
    });
    $("#Accordion1 .panel").on('hide.bs.collapse', function () {
        $(this).removeClass('active');
    });

    // Восстанавливаем состояние аккордеона
    if (isOpen) {
        setTimeout(() => {
            panelCollapse.addClass('in').css({ height: 'auto' });
            panelCollapse.trigger('shown.bs.collapse');
        }, 50);
    }
}

function createAccordions(shopsArray) {
    var accordionContainer = $('#Accordion1');
    accordionContainer.empty();

    shopsArray.forEach(function (shopInfo, index) {
        var shop = shopInfo.shop;
        var panel = $('<div>').addClass('panel panel-default').attr('data-shop', shop);
        createSingleAccordion(shopInfo, panel, index);
        accordionContainer.append(panel);
    });

    // Привязываем события collapse один раз
    $("#Accordion1 .panel").off('show.bs.collapse hide.bs.collapse');
    $("#Accordion1 .panel").on('show.bs.collapse', function () {
        $(this).addClass('active');
    });
    $("#Accordion1 .panel").on('hide.bs.collapse', function () {
        $(this).removeClass('active');
    });
}