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

/**
 * Обновляет только один аккордеон (панель) по магазину
 * @param {string} shop - код магазина (например, E93)
 * @param {number} panelIndex - индекс панели (аккордеона) на странице
 * @param {function} [onDone] - (необязательно) колбэк после обновления
 */
function updateAccordionPanelOnly(shop, panelIndex, onDone) {
    // 1. Сначала POST на обновление данных магазина
    fetch(`/update_shop/${shop}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.status !== 'ok') {
                if (onDone) onDone(false);
                return;
            }
            // 2. Потом GET на получение новых данных для магазина
            return fetch(`/search_shops/${shop}`);
        })
        .then(response => {
            if (!response) return;
            return response.json();
        })
        .then(shops => {
            if (!shops || !shops.length) {
                if (onDone) onDone(false);
                return;
            }
            // 3. Найти аккордеон по индексу
            var panel = $('#Accordion1 .panel').eq(panelIndex);
            if (!panel.length) {
                if (onDone) onDone(false);
                return;
            }
            // Очищаем панель полностью
            panel.empty();

            var shopInfo = shops[0];
            var shop = shopInfo.shop;
            var adres = shopInfo.adres;
            var pcs = shopInfo.pcs;

            // Воссоздаём шапку панели (как в createAccordions)
            var panelHeading = $('<div>').addClass('panel-heading').attr({ 'role': 'tab' });
            var panelTitle = $('<h4>').addClass('panel-title');
            var panelLink = $('<a>').attr({
                'role': 'button',
                'data-toggle': 'collapse',
                'href': '#Accordion1-collapse' + panelIndex,
                'aria-controls': 'Accordion1-collapse' + panelIndex,
                'aria-expanded': 'false'
            }).text(shop + ' | ' + adres);

            panelLink.prepend($('<span>').addClass('panel-icon'));
            panelLink.prepend($('<i>').addClass('fa fa-window-restore accordion-icon'));

            // --- Иконка обновления справа ---
            var updateIcon = $('<i>')
                .addClass('fa fa-refresh update-shop-icon')
                .css({
                    'margin-left': 'auto',
                    'cursor': 'pointer',
                    'float': 'right',
                    'transition': 'color 0.3s'
                })
                .attr('title', 'Обновить магазин')
                .attr('data-shop', shop)
                .on('click', function (e) {
                    e.stopPropagation();
                    var $icon = $(this);
                    $icon.addClass('fa-spin').css('color', '#007bff');
                    updateAccordionPanelOnly(shop, panelIndex, function(success) {
                        $icon.removeClass('fa-spin');
                        if (!success) {
                            $icon.css('color', 'red');
                        } else {
                            $icon.css('color', '');
                        }
                    });
                });
            panelTitle.append(updateIcon);
            panelTitle.append(panelLink);
            panelHeading.append(panelTitle);
            panel.append(panelHeading);

            // --- Тело панели ---
            var panelCollapse = $('<div>').attr({
                'id': 'Accordion1-collapse' + panelIndex,
                'class': 'panel-collapse collapse',
                'data-parent': '#Accordion1',
                'role': 'tabpanel'
            });
            var panelBody = $('<div>').addClass('panel-body');

            // --- Таблицы и кнопки для каждого ПК ---
            var index_counter = panelIndex * 1000; // как в createAccordions

            pcs.forEach(function (pcInfo) {
                var labelColor = pcInfo.status ? '#00bc00' : '#ff0000';
                var indexItem = 4;
                var wb_LayoutGrid = $('<div>').attr({ 'id': 'wb_LayoutGrid' + indexItem });
                var layoutGrid = $('<div>').attr({ 'id': 'LayoutGrid' + indexItem });

                // col-1: картинка ОС
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

                // col-2: кнопки и таблица параметров
                var col2 = $('<div>').addClass('col-2');
                var buttonsContainer = $('<div>').css({
                    'display': 'flex',
                    'justify-content': 'space-between',
                    'width': '100%',
                    'gap': '10px'
                });

                // --- Кнопки (копия из createAccordions) ---
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

                    if (!pcInfo.status) buttonMsg.addClass('button-disabled');
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

                    if (!pcInfo.status) buttonSSH.addClass('button-disabled');
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

                    if (!pcInfo.status) buttonRDP.addClass('button-disabled');
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
                if (!pcInfo.status) buttonVNC.addClass('button-disabled');
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

                // --- Формирование таблицы параметров ПК ---
                var tableData = [
                    { label: "Тип ОС:", value: pcInfo.type_os },
                    { label: "Аптайм:", value: pcInfo.uptime },
                    { label: "CPU:", value: pcInfo.cpu_model },
                    { label: "GPU:", value: (pcInfo.gpu_model || '').replace(/\n/g, "<br>") },
                    { label: "Память:", value: pcInfo.ram },
                    { label: "Константы:", value: pcInfo.constants },
                    { label: "Пароль на кассу:", value: pcInfo.cash_pass },
                ];

                var tableStyles = {
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
                var cellStyles = {
                    background: "transparent",
                    border: "1px #C0C0C0 solid",
                    textAlign: "left",
                    verticalAlign: "top",
                    color: "#000000",
                    fontFamily: "Arial",
                    fontSize: "13px",
                    lineHeight: "16px"
                };
                var pStyles = {
                    margin: "0",
                    padding: "0",
                    whiteSpace: "nowrap"
                };

                var table = document.createElement("table");
                table.className = "table_params";
                table.id = "Table" + index_counter;
                if (typeof applyStyles === 'function') applyStyles(table, tableStyles);

                table.setAttribute('shop', shop);
                table.setAttribute('pc', pcInfo.pc);
                table.setAttribute('ip', pcInfo.ip);
                table.setAttribute('indexCounter', index_counter);

                tableData.forEach((item, i) => {
                    var row = table.insertRow();
                    var cell1 = row.insertCell(0);
                    var cell2 = row.insertCell(1);
                    cell1.className = "cell0";
                    cell2.className = "cell0";
                    cell1.innerHTML = `<p>${item.label}</p>`;
                    cell2.innerHTML = `<p>${item.value}</p>`;
                    cell2.setAttribute('data-index', i);

                    if (typeof applyStyles === 'function') {
                        applyStyles(cell1, cellStyles);
                        applyStyles(cell2, cellStyles);
                    }

                    var pElements = row.querySelectorAll('p');
                    if (typeof applyStyles === 'function') {
                        pElements.forEach(p => {
                            applyStyles(p, pStyles);
                        });
                    }
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

            // --- collapse события ---
            $("#Accordion1 .panel").off('show.bs.collapse hide.bs.collapse');
            $("#Accordion1 .panel").on('show.bs.collapse', function () {
                $(this).addClass('active');
            });
            $("#Accordion1 .panel").on('hide.bs.collapse', function () {
                $(this).removeClass('active');
            });

            if (onDone) onDone(true);
        })
        .catch(() => {
            if (onDone) onDone(false);
        });
}

function createAccordions(shopsArray) {
    var accordionContainer = $('#Accordion1');
    accordionContainer.empty();

    var index_counter = 0;
    shopsArray.forEach(function (shopInfo, index) {
        var shop = shopInfo.shop;
        var adres = shopInfo.adres;
        var pcs = shopInfo.pcs;

        var panel = $('<div>').addClass('panel panel-default');
        var panelHeading = $('<div>').addClass('panel-heading').attr({ 'role': 'tab' });
        var panelTitle = $('<h4>').addClass('panel-title');
        var panelLink = $('<a>').attr({
            'role': 'button',
            'data-toggle': 'collapse',
            'href': '#Accordion1-collapse' + index,
            'aria-controls': 'Accordion1-collapse' + index,
            'aria-expanded': 'false'
        }).text(shop + ' | ' + adres);

        panelLink.prepend($('<span>').addClass('panel-icon'));
        panelLink.prepend($('<i>').addClass('fa fa-window-restore accordion-icon'));

        panelTitle.append(panelLink);

        // Создаём иконку для обновления
        var updateIcon = $('<i>')
            .addClass('fa fa-refresh update-shop-icon')
            .css({'margin-left': 'auto', 'cursor': 'pointer', 'float': 'right', 'transition': 'color 0.3s'})
            .attr('title', 'Обновить магазин')
            .attr('data-shop', shop)
            // Обработчик нажатия
            .on('click', function (e) {
                e.stopPropagation();
                var $icon = $(this);
                $icon.addClass('fa-spin').css('color', '#007bff');
                updateAccordionPanelOnly(shop, index, function(success) {
                    $icon.removeClass('fa-spin');
                    if (!success) {
                        $icon.css('color', 'red');
                    } else {
                        $icon.css('color', '');
                    }
                });
            });
        panelTitle.append(updateIcon);

        panelHeading.append(panelTitle);
        
        panel.append(panelHeading);

        var panelCollapse = $('<div>').attr({
            'id': 'Accordion1-collapse' + index,
            'class': 'panel-collapse collapse',
            'data-parent': '#Accordion1',
            'role': 'tabpanel'
        });
        var panelBody = $('<div>').addClass('panel-body');

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

        accordionContainer.append(panel);
    });

    $("#Accordion1 .panel").on('show.bs.collapse', function () {
        $(this).addClass('active');
    });
    $("#Accordion1 .panel").on('hide.bs.collapse', function () {
        $(this).removeClass('active');
    });
}