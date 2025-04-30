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
                fetchShops(this.value);
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

async function fetchShops(searchText) {
    if (searchText.trim() !== '') {
        try {
            const response = await fetch(`/search_shops/${searchText}`);
            const shops = await response.json();
            createAccordions(shops);
            scrollToTop();
        } catch (error) {
            console.error('Error fetching shops:', error);
        }
    }
}

function createAccordions(shopsArray) {
    var accordionContainer = $('#Accordion1');
    accordionContainer.empty();

    shopsArray.forEach(async function (shopInfo, index) {
        var shop = shopInfo.shop;
        var adres = shopInfo.adres;
        var pcs = shopInfo.pcs;

        var panel = $('<div>').addClass('panel panel-default');
        var panelHeading = $('<div>').addClass('panel-heading').attr({ 'role': 'tab' });
        var panelTitle = $('<h4>').addClass('panel-title');
        var panelLink = $('<a>').attr({
            'role': 'button',
            'data-toggle': 'collapse',
            'href': `#Accordion1-collapse${index}`,
            'aria-controls': `Accordion1-collapse${index}`,
            'aria-expanded': 'false'
        }).text(`${shop} | ${adres}`);

        panelLink.prepend($('<span>').addClass('panel-icon'));
        panelLink.prepend($('<i>').addClass('fa fa-window-restore accordion-icon'));

        panelTitle.append(panelLink);
        panelHeading.append(panelTitle);
        panel.append(panelHeading);

        var panelCollapse = $('<div>').attr({
            'id': `Accordion1-collapse${index}`,
            'class': 'panel-collapse collapse',
            'data-parent': '#Accordion1',
            'role': 'tabpanel'
        });
        var panelBody = $('<div>').addClass('panel-body');

        pcs.forEach(async (pcInfo, index_counter) => {
            var labelColor = pcInfo.status ? '#00bc00' : '#ff0000';
            var wb_LayoutGrid = $('<div>').attr({ 'id': `wb_LayoutGrid${index_counter}` });
            var layoutGrid = $('<div>').attr({ 'id': `LayoutGrid${index_counter}` });
            var col1 = $('<div>').addClass('col-1');
            var wb_Image = $('<div>').attr({ 'id': `wb_PicOS${index_counter}` });

            var image = $('<img>').attr({
                'indexCounter': index_counter,
                'src': pcInfo.pic_os,
                'id': `PicOS${index_counter}`,
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

            createButtons(pcInfo, buttonsContainer, index_counter);
            col2.append(buttonsContainer);

            var table = createTable(pcInfo, index_counter, shop);
            col2.append(table);
            layoutGrid.append(col2);
            wb_LayoutGrid.append(layoutGrid);
            panelBody.append(wb_LayoutGrid);

            checkIpAndFetchParams(pcInfo, index_counter, shop);
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

function createButtons(pcInfo, buttonsContainer, index_counter) {
    if (pcInfo.rdp_link === '') {
        var buttonMsg = $('<a>').addClass('buttonPCMsg').attr({
            'title': 'Отправка сообщения',
            'indexCounter': index_counter,
            'id': `ButtonPCMsg${index_counter}`,
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
        var buttonSSH = $('<a>').addClass('buttonPCSSH').attr({
            'title': 'Подключение по SSH',
            'indexCounter': index_counter,
            'id': `ButtonPCSSH${index_counter}`,
            'href': pcInfo.ssh_link,
            'data-label': pcInfo.ip,
            'target': '_blank',
            'style': 'display:block;width: 45%;height:25px;z-index:6;position:relative;text-decoration:none;'
        }).text(`SSH_${pcInfo.pc}`);

        if (!pcInfo.status) buttonSSH.addClass('button-disabled');

        buttonsContainer.append(buttonSSH);
    } else {
        var buttonRDP = $('<a>').addClass('buttonPCRDP').attr({
            'title': 'Подключение по RDP',
            'indexCounter': index_counter,
            'id': `ButtonPCRDP${index_counter}`,
            'href': pcInfo.rdp_link,
            'data-label': pcInfo.ip,
            'target': '_blank',
            'style': 'display:block;width: 50%;height:25px;z-index:6;position:relative;text-decoration:none;'
        }).text(`RDP_${pcInfo.pc}`);

        if (!pcInfo.status) buttonRDP.addClass('button-disabled');

        buttonsContainer.append(buttonRDP);
    }

    var buttonVNC = $('<a>').addClass('buttonPCVNC').attr({
        'title': 'Подключение по VNC',
        'indexCounter': index_counter,
        'id': `ButtonPCVNC${index_counter}`,
        'href': pcInfo.vnc_link,
        'data-label': pcInfo.ip,
        'target': '_blank',
        'style': pcInfo.rdp_link === '' ? 'display:block;width: 50%;height:25px;z-index:6;position:relative;text-decoration:none;' : 'display:block;width: 45%;height:25px;z-index:6;position:relative;text-decoration:none;'
    }).text(`VNC_${pcInfo.pc}`);

    buttonVNC.css('--label-background-color', pcInfo.status ? '#00bc00' : '#ff0000');
    if (!pcInfo.status) buttonVNC.addClass('button-disabled');

    buttonsContainer.append(buttonVNC);
}

function createTable(pcInfo, index_counter, shop) {
    const tableData = [
        { label: "Тип ОС:", value: pcInfo.type_os },
        { label: "Аптайм:", value: pcInfo.uptime },
        { label: "CPU:", value: pcInfo.cpu_model },
        { label: "Загрузка ЦП:", value: pcInfo.cpu_load },
        { label: "RAM:", value: pcInfo.total_ram },
        { label: "Диск:", value: pcInfo.hdd_capacity },
        { label: "Тип устройства:", value: pcInfo.type_pc }
    ];

    var table = $('<table>').addClass('TablePC');
    table.attr('indexCounter', index_counter);

    tableData.forEach(function (row) {
        var tr = $('<tr>');
        var tdLabel = $('<td>').addClass('labelTD').css('text-align', 'right').text(row.label);
        var tdValue = $('<td>').addClass('infoTD').attr('id', `${row.label}${index_counter}`).text(row.value);
        tr.append(tdLabel);
        tr.append(tdValue);
        table.append(tr);
    });

    return table;
}

async function checkIpAndFetchParams(pcInfo, index_counter, shop) {
    const ip = pcInfo.ip;
    try {
        const availabilityResponse = await fetch(`/check_ip/${ip}`);
        const availability = await availabilityResponse.json();

        if (availability) {
            const paramsResponse = await fetch(`/get_params/${shop}/${pcInfo.pc}`);
            const params = await paramsResponse.json();

            updateTable(params, index_counter);
        }
    } catch (error) {
        console.error('Error checking IP or fetching params:', error);
    }
}

function updateTable(params, index_counter) {
    const { type_os, uptime, cpu_model, cpu_load, total_ram, hdd_capacity, type_pc } = params;

    $(`#typeOS${index_counter}`).text(type_os);
    $(`#uptime${index_counter}`).text(uptime);
    $(`#cpuModel${index_counter}`).text(cpu_model);
    $(`#cpuLoad${index_counter}`).text(cpu_load);
    $(`#totalRAM${index_counter}`).text(total_ram);
    $(`#hddCapacity${index_counter}`).text(hdd_capacity);
    $(`#typePC${index_counter}`).text(type_pc);
}
