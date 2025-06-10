// ==UserScript==
// @name         微信读书自定义背景（v2.2 - 强大的自定义渐变）
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  新增“自定义渐变”功能，自由调配你的专属渐变背景！支持为所有背景（图片、纯色、渐变）调节透明度，并提供更丰富的预设选项。
// @author       根据您的需求和反馈优化
// @match        https://weread.qq.com/web/reader/*
// @icon         https://weread.qq.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('[微信读书背景脚本 v2.2] 开始加载...');

    // --- 初始背景配置 ---
    let backgroundOptions = [
        { type: 'image', name: '默认图片', value: 'https://images.unsplash.com/photo-1593776214534-4a49147b3117?q=80&w=1920' },
        // 预设渐变色选项
        { type: 'gradient', name: '晨曦', value: 'linear-gradient(135deg, #f5e3e6, #dfe9f3)' },
        { type: 'gradient', name: '碧海', value: 'linear-gradient(135deg, #e0f2f1, #e3f2fd)' },
        { type: 'gradient', name: '晚霞', value: 'linear-gradient(135deg, #f3e5f5, #fff3e0)' },
        { type: 'gradient', name: '晴空', value: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' }, // 新增
        { type: 'gradient', name: '幽林', value: 'linear-gradient(135deg, #d4e7c5, #e8f5e9)' }, // 新增
        // 纯色选项
        { type: 'color', name: '清茶', value: '#e8f5e9' },
        { type: 'color', name: '书卷', value: '#f8f5ef' },
        { type: 'color', name: '远山', value: '#f0f4f8' },
        // 自定义选项占位符
        { type: 'gradient_custom', name: '自定义渐变', value: { start: '#e0c3fc', end: '#8ec5fc' } }, // 默认自定义值
        { type: 'color', name: '自定义纯色', value: '#ffffff' }
    ];
    const defaultOpacity = 0.9;
    const SETTINGS_STORAGE_KEY = 'weread_custom_background_settings_v2.2';
    const USER_DEFAULT_IMG_KEY = 'weread_user_default_image_url_v2.2';
    const STYLE_ID = 'custom-background-style-element';
    const BUTTON_ID = 'custom-bg-trigger-button';
    const PANEL_ID = 'custom-background-panel';
    const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

    let panelElement = null;
    let currentSettings = {};

    // --- 核心功能函数 ---

    function applyStyles(settings) {
        let styleElement = document.getElementById(STYLE_ID);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = STYLE_ID;
            document.head.appendChild(styleElement);
        }

        let cssText = `
            body.wr_page_reader { background-color: #EAEAEA !important; }
            .wr_whiteTheme .readerChapterContent {
                position: relative !important; z-index: 1 !important; background-image: none !important;
                border: none !important; box-shadow: none !important;
            }
            .wr_whiteTheme .readerChapterContent::before {
                content: '' !important; position: absolute !important; top: 0 !important; left: 0 !important;
                right: 0 !important; bottom: 0 !important; z-index: -1 !important;
                background-size: cover !important; background-position: center center !important;
                background-attachment: fixed !important; background-repeat: no-repeat !important;
                pointer-events: none !important;
                transition: opacity 0.3s, background-color 0.3s, background-image 0.3s;
            }
            .wr_whiteTheme .readerChapterContent .reader_RichText,
            .wr_whiteTheme .readerChapterContent .renderTargetContainer { background: transparent !important; }`;

        const opacity = settings.opacity ?? defaultOpacity;
        let bgImageValue = 'none';

        if (settings.type === 'image' && settings.value) {
            bgImageValue = `url('${settings.value}')`;
        } else if (settings.type === 'gradient' && typeof settings.value === 'string') {
            bgImageValue = settings.value;
        } else if (settings.type === 'gradient_custom' && typeof settings.value === 'object') {
            bgImageValue = `linear-gradient(135deg, ${settings.value.start}, ${settings.value.end})`;
        }

        if (bgImageValue !== 'none') {
            cssText += `
                .wr_whiteTheme .readerChapterContent { background-color: #FFFFFF !important; }
                .wr_whiteTheme .readerChapterContent::before { background-image: ${bgImageValue} !important; opacity: ${opacity} !important; }`;
        } else if (settings.type === 'color' && settings.value) {
            const rgbaColor = hexToRgba(settings.value, opacity);
            cssText += `
                .wr_whiteTheme .readerChapterContent { background-color: ${rgbaColor} !important; }
                .wr_whiteTheme .readerChapterContent::before { background-image: none !important; opacity: 1 !important; }`;
        } else {
             cssText += `
                .wr_whiteTheme .readerChapterContent { background-color: #FFFFFF !important; }
                .wr_whiteTheme .readerChapterContent::before { background-image: none !important; opacity: 1 !important; }`;
        }
        styleElement.textContent = cssText;
    }

    async function saveActiveSettings(settings) { await GM_setValue(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); }
    async function loadActiveSettings() {
        const saved = await GM_getValue(SETTINGS_STORAGE_KEY, null);
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings && settings.type) {
                    settings.opacity = settings.opacity ?? defaultOpacity;
                    return settings;
                }
            } catch (e) { console.error(e); }
        }
        return { ...(backgroundOptions.find(opt => opt.type === 'image')), opacity: defaultOpacity };
    }
    async function saveUserDefaultImage(dataUrl) { await GM_setValue(USER_DEFAULT_IMG_KEY, dataUrl); }
    async function loadUserDefaultImage() { return await GM_getValue(USER_DEFAULT_IMG_KEY, null); }
    function updateUserDefaultInOptions(dataUrl) {
        const opt = backgroundOptions.find(o => o.name === '默认图片');
        if (opt) opt.value = dataUrl;
    }
    function hexToRgba(hex, alpha) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha ?? 1})`;
    }
    function getBrightness(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
        return (parseInt(hex.substring(0,2),16)*299 + parseInt(hex.substring(2,4),16)*587 + parseInt(hex.substring(4,6),16)*114)/1000;
    }

    // --- UI Creation ---
    function createPanel() {
        if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);
        panelElement = document.createElement('div');
        panelElement.id = PANEL_ID;
        panelElement.style.cssText = `position:fixed; z-index:10001; bottom:60px; right:20px; width:320px; max-height:calc(100vh - 80px); overflow-y:auto; background-color:#fff; border:1px solid #DBDBDB; border-radius:12px; box-shadow:0 8px 25px rgba(0,0,0,0.1); padding:20px; box-sizing:border-box; display:none; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#333; line-height:normal; text-align:left; transition:opacity .2s,transform .2s;`;

        // Title
        panelElement.innerHTML = `<div style="font-weight:600; font-size:16px; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid #eee;">自定义阅读背景</div>`;

        // Options Grid
        const optionsGrid = document.createElement('div');
        optionsGrid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;';
        backgroundOptions.forEach(option => {
            const button = createOptionButton(option);
            button.addEventListener('click', () => {
                if (option.name === '自定义纯色') {
                    panelElement.querySelector('#custom-color-picker')?.click();
                } else if (option.name === '自定义渐变') {
                    currentSettings.type = 'gradient_custom';
                    // 如果没有值，使用默认值
                    if (!currentSettings.value || typeof currentSettings.value !== 'object') {
                        currentSettings.value = backgroundOptions.find(o => o.type === 'gradient_custom').value;
                    }
                } else {
                    currentSettings.type = option.type;
                    currentSettings.value = option.value;
                }
                applyStyles(currentSettings);
                saveActiveSettings(currentSettings);
                updatePanelUI();
            });
            optionsGrid.appendChild(button);
        });
        const noneButton = createOptionButton({ type: 'none', name: '无背景', value: 'null' });
        noneButton.style.borderStyle = 'dashed';
        noneButton.addEventListener('click', () => {
            currentSettings.type = 'none'; currentSettings.value = null;
            applyStyles(currentSettings); saveActiveSettings(currentSettings); updatePanelUI();
        });
        optionsGrid.appendChild(noneButton);
        panelElement.appendChild(optionsGrid);

        // Separator
        panelElement.insertAdjacentHTML('beforeend', `<hr style="border:none; border-top:1px solid #eee; margin:20px 0;">`);

        // Custom Gradient Controls (Initially Hidden)
        const customGradientControls = document.createElement('div');
        customGradientControls.id = 'custom-gradient-controls';
        customGradientControls.style.cssText = `display:none; flex-direction:column; gap:10px; margin-bottom:20px; padding:12px; border:1px solid #eee; border-radius:8px; background-color:#f9f9f9;`;
        customGradientControls.innerHTML = `<div style="font-weight:500; font-size:13px; color:#555;">自定义渐变色</div>`;
        const gradientPickers = document.createElement('div');
        gradientPickers.style.cssText = 'display:flex; justify-content:space-around; align-items:center;';
        ['start', 'end'].forEach(pos => {
            const pickerWrapper = document.createElement('div');
            pickerWrapper.style.textAlign = 'center';
            const label = document.createElement('label');
            label.textContent = pos === 'start' ? '起始色' : '结束色';
            label.style.cssText = 'display:block; font-size:12px; margin-bottom:5px; color:#777;';
            const picker = document.createElement('input');
            picker.type = 'color';
            picker.id = `gradient-color-${pos}`;
            picker.style.cssText = 'border:1px solid #ccc; border-radius:6px; padding:2px; width:50px; height:30px; cursor:pointer; background:#fff;';
            picker.addEventListener('input', () => {
                const startColor = panelElement.querySelector('#gradient-color-start').value;
                const endColor = panelElement.querySelector('#gradient-color-end').value;
                currentSettings.type = 'gradient_custom';
                currentSettings.value = { start: startColor, end: endColor };
                applyStyles(currentSettings);
                saveActiveSettings(currentSettings);
            });
            pickerWrapper.append(label, picker);
            gradientPickers.appendChild(pickerWrapper);
        });
        customGradientControls.appendChild(gradientPickers);
        panelElement.appendChild(customGradientControls);

        // Upload, Color, Opacity Section
        const controlsWrapper = document.createElement('div');
        panelElement.appendChild(controlsWrapper);

        // Upload
        const fileInput = document.createElement('input');
        fileInput.type='file'; fileInput.accept='image/*'; fileInput.style.display='none'; fileInput.addEventListener('change',handleFileUpload);
        controlsWrapper.innerHTML = `<div style="margin-bottom:20px;"><button id="upload-btn" style="display:flex; align-items:center; justify-content:center; width:100%; padding:10px; background-color:#f5f5f5; border:1px solid #ddd; border-radius:8px; cursor:pointer; font-size:14px; font-weight:500; color:#333; transition:background-color .2s;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align:-3px; margin-right:8px;"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v-2H5v2z"/></svg><span>上传新默认图</span></button><div style="font-size:11px; color:#999; text-align:center; margin-top:8px;">替换“默认图片”，建议 < ${MAX_IMAGE_SIZE/1024/1024}MB</div></div>`;
        controlsWrapper.querySelector('#upload-btn').addEventListener('click', () => fileInput.click());
        controlsWrapper.appendChild(fileInput);

        // Color & Opacity
        controlsWrapper.insertAdjacentHTML('beforeend', `
            <div style="display:flex; flex-direction:column; gap:15px;">
                <div id="custom-color-area" style="display:flex; align-items:center; justify-content:space-between;">
                    <label style="font-weight:500;">自定义纯色</label>
                    <input type="color" id="custom-color-picker" style="border:1px solid #ccc; border-radius:6px; padding:2px; width:40px; height:28px; cursor:pointer; background:#fff;">
                </div>
                <div id="opacity-area">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                        <label style="font-weight:500;">背景透明度</label>
                        <span id="opacity-value-display" style="font-family:monospace; color:#555;"></span>
                    </div>
                    <input type="range" id="opacity-slider" min="0.05" max="1" step="0.01" style="width:100%;">
                </div>
            </div>
        `);
        panelElement.querySelector('#custom-color-picker').addEventListener('input', (e) => {
            currentSettings.type='color'; currentSettings.value=e.target.value;
            applyStyles(currentSettings); saveActiveSettings(currentSettings); updatePanelUI();
        });
        const opacitySlider = panelElement.querySelector('#opacity-slider');
        opacitySlider.addEventListener('input', (e) => {
            const newOpacity = parseFloat(e.target.value);
            panelElement.querySelector('#opacity-value-display').textContent = newOpacity.toFixed(2);
            currentSettings.opacity = newOpacity;
            applyStyles(currentSettings);
            clearTimeout(opacitySlider.saveTimeout);
            opacitySlider.saveTimeout = setTimeout(() => saveActiveSettings(currentSettings), 500);
        });

        document.body.appendChild(panelElement);
        updatePanelUI();
        return panelElement;
    }

    function createOptionButton(option) {
        const button = document.createElement('div');
        button.textContent = option.name;
        button.dataset.type = option.type;
        button.dataset.value = typeof option.value === 'object' ? JSON.stringify(option.value) : option.value;
        button.classList.add('bg-option-button');
        button.style.cssText = `height:50px; display:flex; align-items:center; justify-content:center; border:2px solid #E0E0E0; border-radius:8px; cursor:pointer; font-size:14px; font-weight:500; overflow:hidden; transition:all .2s ease-in-out; position:relative; background-size:cover; background-position:center;`;
        button.addEventListener('mouseover', () => { if (!button.classList.contains('selected')) button.style.borderColor = '#B0B0B0'; });
        button.addEventListener('mouseout', () => { if (!button.classList.contains('selected')) button.style.borderColor = '#E0E0E0'; });
        updateOptionButtonPreview(button, option);
        return button;
    }

    function updateOptionButtonPreview(button, optionData) {
        let bgImage = 'none', bgColor = 'transparent', color = '#333', textShadow = 'none', borderStyle = 'solid';
        if (optionData.type === 'image') {
            bgImage = `url('${optionData.value}')`; color = '#fff'; textShadow = '0 1px 3px rgba(0,0,0,0.6)';
        } else if (optionData.type === 'gradient') {
            bgImage = optionData.value; color = '#333'; textShadow = '0 1px 2px rgba(255,255,255,0.5)';
        } else if (optionData.type === 'gradient_custom') {
            bgImage = `linear-gradient(135deg, ${optionData.value.start}, ${optionData.value.end})`;
            color = '#fff'; textShadow = '0 1px 3px rgba(0,0,0,0.5)'; borderStyle = 'dashed';
        } else if (optionData.type === 'color') {
            if (optionData.name !== '自定义纯色') {
                bgColor = optionData.value; color = getBrightness(optionData.value) > 128 ? '#333' : '#fff';
            } else {
                bgColor = '#fff'; borderStyle = 'dashed';
            }
        }
        button.style.backgroundImage = bgImage;
        button.style.backgroundColor = bgColor;
        button.style.color = color;
        button.style.textShadow = textShadow;
        button.style.borderStyle = borderStyle;
        button.dataset.value = typeof optionData.value === 'object' ? JSON.stringify(optionData.value) : optionData.value;
    }

    function updatePanelUI() {
        if (!panelElement) return;

        // Update option buttons selection
        panelElement.querySelectorAll('.bg-option-button').forEach(btn => {
            const type = btn.dataset.type;
            let isSelected = false;
            if (type === 'gradient_custom' && currentSettings.type === 'gradient_custom') {
                isSelected = true;
            } else if (type === 'color' && btn.textContent === '自定义纯色' && currentSettings.type === 'color' && !backgroundOptions.some(o => o.type === 'color' && o.name !== '自定义纯色' && o.value === currentSettings.value)) {
                isSelected = true;
            } else {
                isSelected = (type === currentSettings.type && btn.dataset.value === currentSettings.value);
            }

            if (isSelected) {
                btn.style.borderColor = '#007AFF'; btn.style.boxShadow = '0 0 8px rgba(0,122,255,0.3)'; btn.classList.add('selected');
            } else {
                btn.style.borderColor = '#E0E0E0'; btn.style.boxShadow = 'none'; btn.classList.remove('selected');
                if(btn.dataset.type.includes('custom') || btn.dataset.type === 'none') btn.style.borderStyle = 'dashed';
            }
        });

        // Update default image button preview
        const defaultImgBtn = Array.from(panelElement.querySelectorAll('.bg-option-button')).find(b => b.textContent === '默认图片');
        if(defaultImgBtn) updateOptionButtonPreview(defaultImgBtn, backgroundOptions.find(o => o.name === '默认图片'));

        // Toggle and update custom gradient controls
        const customGradientControls = panelElement.querySelector('#custom-gradient-controls');
        const isCustomGradient = currentSettings.type === 'gradient_custom';
        customGradientControls.style.display = isCustomGradient ? 'flex' : 'none';
        if (isCustomGradient) {
            panelElement.querySelector('#gradient-color-start').value = currentSettings.value.start;
            panelElement.querySelector('#gradient-color-end').value = currentSettings.value.end;
        }

        // Update custom color picker
        panelElement.querySelector('#custom-color-picker').value = (currentSettings.type === 'color') ? currentSettings.value : '#ffffff';

        // Update opacity slider
        const opacitySlider = panelElement.querySelector('#opacity-slider');
        const opacityValueDisplay = panelElement.querySelector('#opacity-value-display');
        const isDisabled = currentSettings.type === 'none';
        opacitySlider.disabled = isDisabled;
        opacitySlider.value = currentSettings.opacity ?? defaultOpacity;
        opacityValueDisplay.textContent = parseFloat(opacitySlider.value).toFixed(2);
        opacitySlider.closest('#opacity-area').style.opacity = isDisabled ? '0.5' : '1';
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) return alert('请选择一个图片文件。');
        if (file.size > MAX_IMAGE_SIZE) return alert(`图片文件过大，请小于 ${MAX_IMAGE_SIZE/1024/1024}MB。`);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target.result;
            await saveUserDefaultImage(dataUrl);
            updateUserDefaultInOptions(dataUrl);
            if (currentSettings.name === '默认图片') {
                currentSettings.value = dataUrl;
                applyStyles(currentSettings);
            }
            if (panelElement) updatePanelUI();
            alert('新的默认背景图片已上传并保存！');
        };
        reader.onerror = () => alert('读取图片文件时出错。');
        reader.readAsDataURL(file);
        event.target.value = null;
    }

    // --- Init & Observers ---
    async function init() {
        const userDefaultDataUrl = await loadUserDefaultImage();
        if (userDefaultDataUrl) updateUserDefaultInOptions(userDefaultDataUrl);
        currentSettings = await loadActiveSettings();
        if (currentSettings.name === '默认图片') {
            currentSettings.value = backgroundOptions.find(o => o.name === '默认图片').value;
        }
        applyStyles(currentSettings);

        const controls = document.querySelector('.readerControls');
        if (!controls || document.getElementById(BUTTON_ID)) { if (!controls) setTimeout(init, 1000); return; }

        const triggerButton = document.createElement('button');
        triggerButton.id = BUTTON_ID; triggerButton.title = '自定义背景'; triggerButton.innerHTML = '🎨';
        triggerButton.className = 'readerControls_item';
        triggerButton.style.cssText = 'font-size: 22px; line-height: 48px; order: 10;';
        const fontSizeButton = controls.querySelector('.fontSizeButton');
        if (fontSizeButton) controls.insertBefore(triggerButton, fontSizeButton.nextSibling);
        else controls.appendChild(triggerButton);

        triggerButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!panelElement) panelElement = createPanel();
            panelElement.style.display = panelElement.style.display === 'block' ? 'none' : 'block';
            if (panelElement.style.display === 'block') updatePanelUI();
        });
        console.log('[微信读书背景脚本 v2.2] 初始化完成。');
    }

    document.addEventListener('click', (e) => {
        if (panelElement && panelElement.style.display === 'block' && !panelElement.contains(e.target) && e.target.id !== BUTTON_ID) {
            panelElement.style.display = 'none';
        }
    }, true);

    const observer = new MutationObserver(() => {
        if (document.querySelector('.readerControls') && !document.getElementById(BUTTON_ID)) {
            setTimeout(init, 200);
        }
    });

    window.addEventListener('load', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(init, 500);
    }, false);

})();