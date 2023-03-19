/**
 * style form
 */
function styleForm() {
    let inputs = document.querySelectorAll('input, textarea, select, button');
    inputs.forEach(inp => {
        let type = inp.getAttribute('type') ? inp.getAttribute('type') : inp.nodeName.toLowerCase();
        let parent = inp.parentNode;
        let prev = inp.previousElementSibling;
        let label;
        let iconSVG;

        inp.classList.add(`input__${type}`);
        let wrap = '';

        switch (type) {

            case 'text':
                break;

            case 'checkbox':
                iconSVG = `<svg viewBox="0 0 90 100" class="svg__icon svg__icon--checkbox"><use href="#checkbox" /></svg>`;

                if (inp.classList.contains('input-checkbox-slider')) {
                    iconSVG = `<svg viewBox="0 0 160 100" class="svg__icon svg__icon--checkbox"><use href="#checkbox__slider" /></svg>`;
                }
                break;

            case 'radio':
                iconSVG = `<svg viewBox="0 0 95 100" class="svg__icon svg__icon--checkbox"><use href="#radio" /></svg>`;
                break;

            case 'select':
                wrap = document.createElement('div')
                wrap.classList.add('input__stylewrap', 'input__stylewrap--select');

                parent.appendChild(wrap)
                wrap.appendChild(inp)

                iconSVG = `<svg viewBox="0 0 100 100" class="svg__icon svg__icon--select"><use href="#chevron" /></svg>`;
                wrap.insertAdjacentHTML('beforeend', iconSVG)
                break;

            case 'textarea':
                wrap = inp.closest('.input__wrap');
                wrap.classList.add('input__wrap--textarea');

                if (prev.nodeName.toLowerCase() === 'label') {
                    prev.classList.add('label__textarea');
                }
                break;

            case 'range':
                label = prev;
                let spanValue = document.createElement('span');
                let max = inp.getAttribute('max');
                let maxDisplay = max ? '/' + max : '';
                label.classList.add('dsp-blc');
                spanValue.classList.add('input__range--value');
                prev.appendChild(spanValue);
                spanValue.textContent = '(' + inp.value + maxDisplay + ')';

                inp.addEventListener('input', e => {
                    spanValue.textContent = '(' + e.currentTarget.value + maxDisplay + ')';
                })
                break;


            case 'file':
                let droparea = document.createElement('div');
                label = inp.previousElementSibling;
                droparea.classList.add('drop-area', 'brd', 'brd-dotted');

                iconSVG = `<svg viewBox="0 0 56.3 117.5" class="svg__icon svg__icon--inline svg__icon--file">
                <use href="#icon__file" /></svg>`;

                label.insertAdjacentHTML('afterbegin', iconSVG)
                parent.insertBefore(droparea, inp);
                droparea.appendChild(label);
                droparea.appendChild(inp);


                inp.addEventListener('change', e => {
                    handleFiles(e.currentTarget.files)
                });
                initDropzone();
                break;

        }

        if (type !== 'checkbox' && type !== 'radio' && type !== 'number') {
            inp.classList.add(`w100p`);

        }

        if (type === 'checkbox' || type === 'radio') {
            parent.classList.add('input__stylewrap');
            inp.classList.add('input__hidden');

            // toogle current state
            toggleInputState(inp)
            parent.insertAdjacentHTML('afterbegin', iconSVG)

            if (type === 'radio') {
                let radioGroupEl = parent.parentNode;
                let radios = radioGroupEl.querySelectorAll('input[type=radio]');
                inp.addEventListener('click', e => {
                    radios.forEach(radio => {
                        toggleInputState(radio)
                    });
                })

            } else {
                inp.addEventListener('click', e => {
                    toggleInputState(inp)
                });

            }
        }
    })
}

/**
 * toggle styled svg checkboxes
 */
function toggleInputState(input) {
    let active;
    let type = input.getAttribute('type');
    let parent = input.parentNode;

    if (type === 'checkbox') {
        active = input.checked
    }

    else if (type === 'radio') {
        active = input.checked
    }
    if (active) {
        parent.classList.add('input__stylewrap--active');
        parent.classList.remove('input__stylewrap--inactive');
    } else {
        parent.classList.remove('input__stylewrap--active');
        parent.classList.add('input__stylewrap--inactive');

    }
}

/**
* copy to clipboard
*/
let btnsCopy = document.querySelectorAll('.btn-copy');
if (btnsCopy.length) {
    btnsCopy.forEach(function (btn, i) {


        // add icons
        let svgIcon = `<svg role="img" class="svg__icon svg__icon--inline" viewBox="0 0 68.2 117.5" fill="currentColor"><use href="#icon__copy" /></svg> `;

        btn.insertAdjacentHTML('afterbegin', svgIcon);


        btn.addEventListener('click', (e) => {
            let copyTarget = e.currentTarget.getAttribute('data-copy');
            let copyEl = document.querySelector(copyTarget);

            //if(copyEl.nodeName.toLowerCase()==='textarea')
            let textToCopy = '';
            if (copyEl.children.length) {
                textToCopy = new XMLSerializer().serializeToString(copyEl);
            } else {
                textToCopy = copyEl.value;
            }

            navigator.clipboard.writeText(textToCopy).then(
                () => {
                    console.log('The text was copied to your clipboard')
                    console.log(textToCopy);
                },
                () => {
                    window.alert('Opps! Your browser does not support the Clipboard API')
                }
            )
        })
    })
}



/**
 * handle file uploads
 */
function initDropzone() {
    let dropArea = document.querySelector('.drop-area');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
        dropArea.addEventListener(e, preventDefaults, false)
    })

    function preventDefaults(e) {
        e.preventDefault()
        e.stopPropagation()
    }
    dropArea.addEventListener('drop', handleDrop, false);
    dropArea.addEventListener('click', e => {
        inputFile.value = '';
        inputFile.click();
    });
}


function handleDrop(e) {
    let dt = e.dataTransfer
    let files = dt.files
    handleFiles(files)
}


function handleFiles(files) {
    for (let i = 0; i < files.length; i++) {
        let data = readFiles(files[i]);
    }
}
function readFiles(file, img) {
    var reader = new FileReader();
    let type = file.type
    reader.onload = function (e) {
        let data = e.target.result;

        if (type === 'image/svg+xml') {
            let parser = new DOMParser();
            let doc = parser.parseFromString(data, "image/svg+xml");
            let svg = doc.querySelector('svg');
            //console.log('data', data);
            processFileInput(data)
        };

    }
    //reader.readAsDataURL(file);
    if (type === 'image/svg+xml') {
        reader.readAsText(file);
    } else {
        reader.readAsDataURL(file);
    }
}



/**
 * read and render from svg input
 */
function optimizePathOutput(pathData) {
    let decimals = inputDecimals.value;
    let absoluteOrRelative = document.querySelector('[name=inputAbsoluteRelative]:checked').value;
    let absolute = absoluteOrRelative === 'absolute' ? true : false;
    let relative = absoluteOrRelative === 'relative' ? true : false;
    let shorthands = inputShorthands.checked;
    let longhands = shorthands ? false : true;
    let beautify = inputBeautify.checked;

    // preround for low accuracy 
    if (decimals <= 1 && decimals > -1) {
        pathData = roundPathData(pathData, decimals)
    }
    //update
    let options = {
        relative: relative,
        absolute: absolute,
        decimals: inputDecimals.value,
        shorthands: shorthands,
        longhands: longhands
    }
    pathNew.setPathDataOpt(pathData, options);
    let dNew = pathNew.getAttribute('d')
    if (beautify) {
        dNew = prettyPrintCommands(dNew)
    }
    textareaOut.value = dNew;
}


/**
 * event handlers
 */
textareaIn.addEventListener('input', e => {
    renderSvgFromInput(textareaIn, pathOrig);
})

/**
 * display options
 */
if (inputDarkmode) {
    inputDarkmode.addEventListener('input', e => {
        if (inputDarkmode.checked) {
            document.body.classList.add('dark-mode')
        } else {
            document.body.classList.remove('dark-mode')

        }
    });
    inputDarkmode.dispatchEvent(new Event("input"));
}

if (inputShowMarkers) {
    inputShowMarkers.addEventListener('input', e => {
        if (inputShowMarkers.checked) {
            document.body.classList.add('show-markers')
        } else {
            document.body.classList.remove('show-markers')
        }
    });
    inputShowMarkers.dispatchEvent(new Event("input"));
}



/**
 * render and synchronize
 */
function renderSvgFromInput(input, target) {
    let svg = target.closest('svg');
    let d = textareaIn.value;
    let closed = (/z/gi).test(d);
    if (!closed) {
        preview.classList.add('pathOpen')
    } else {
        preview.classList.remove('pathOpen')
    }
    textareaIn.value = d;
    target.setAttribute('d', d);
    pathNew.setAttribute('d', d);
    adjustViewBox(svg)
    adjustViewBox(svgNew)




}

/**
 * new path
 */
function renderNewSvg(input, target) {
    let svg = target.closest('svg');
}

function prettifyInput(input) {
    input.value = prettyPrintCommands(input.value);
}


function prettyPrintCommands(d) {
    d = d.replaceAll(',', ' ').
        replace(/([a-z])([\s\s]*)/gi, "\n$1 $2").
        replaceAll(' .', ' 0.').
        replaceAll('-', ' -').
        replaceAll('-.', '-0.').
        replace(/\s{2,}/g, ' ').
        replace(/([a-z])([\s\s]*)([a-z])/gi, "$1\n$3").
        trim();
    return d;
}


/**
 * svg icons
 */

function appendSvgAssets(svgAssets) {
    document.body.insertAdjacentHTML('beforeend', svgAssets);
}

let svgAssets =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 100" style="position:absolute;width:0; height:0;" aria-hidden="true">
      <defs>
        <marker id="markerStart" overflow="visible" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="strokeWidth"
            markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <circle cx="5" cy="5" r="5" style="fill:var(--focus-color)" fill="green"></circle>

            <marker id="markerRound" overflow="visible" viewBox="0 0 10 10" refX="5" refY="5"
                markerUnits="strokeWidth" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
                <circle cx="5" cy="5" r="2.5" style="fill:var(--focus-color)"  fill="red"></circle>
            </marker>
    </defs>
      <symbol id="chevron" viewBox="0 0 100 100" overflow="visible">
      <path  id="chevronPath" fill="none" d="
      M88.59 30.7l-38.59 38.59l-38.59-38.59"  style="stroke: var(--stroke); fill: none; stroke-width: calc(var(--stroke-width) * 1.25); transform:rotate(var(--rotate)); transform-origin:center; transition: 0.3s transform;" />
    </symbol>
    <symbol id="radio" viewBox="0 0 95 100" overflow="visible">
      <circle cx="50%" cy="50%" r="42" style="stroke: var(--stroke); fill: var(--fill); stroke-width: var(--stroke-width);" />
      <line x1="50%" x2="50%" y1="50%" y2="50%" pathLength="100" style="stroke: var(--stroke); stroke-width: var(--stroke-width-scale); stroke-dasharray:0 100; transition: 0.1s stroke-width;" stroke-linecap="round" />
    </symbol>
  
    <symbol id="checkbox" viewBox="0 0 90 100" overflow="visible">
      <rect x="5" y="10" width="80" height="80" style="stroke: var(--stroke); stroke-width: var(--stroke-width); fill: var(--fill);" />
      <path id="checkstrokeBG" d="M 20 40 l25 20 l65 -55" pathLength="100" style="stroke:var(--strokeBG); stroke-width: 25px; fill:none; stroke-dasharray: var(--strokeDash) 100;  transition: 0.3s stroke-dasharray;" />
      <path id="checkstroke" d="M 20 40 l25 20 l60 -50" style="stroke: var(--stroke2); stroke-width: var(--stroke-width); fill:none; stroke-dasharray: var(--strokeDash) 100;  transition: 0.3s stroke-dasharray; stroke-dashoffset:0px;" />
    </symbol>
    <symbol id="checkbox__slider" viewBox="0 0 160 100" overflow="visible">
      <rect x="5" y="10" width="150" height="80" rx="40" ry="40" style="stroke: var(--stroke); stroke-width: var(--stroke-width); fill:currentColor;" />
      <circle cx="45" cy="50" r="40" style="transform: translate(var(--translateX), 0); stroke: var(--stroke); fill: var(--fill); stroke-width: var(--stroke-width); transition:0.3s transform;" />
    </symbol>

    <symbol viewBox="0 0 56.3 117.5" id="icon__file" fill="currentColor">
        <path d="M57.3 50.3l-23.4-23.4l-32.9 0l0 75.9l56.3 0zm-9 43.5l-38.3 0l0-57.8l19.1 0l0 19l19.2 0z" />
    </symbol>
    <symbol viewBox="0 0 68.2 117.5" id="icon__copy" fill="currentColor">
        <path
            d="M69.2 54.2l-21.1-21.1l-29.6 0l0 64.3l50.7 0l0-43.2zm-8.1 35.1l-34.5 0l0-48l17.2 0l0 17.1l17.3 0l0 30.9zm-9.2 25.3l-50.9 0l0-63.9l8.1 0l0 55.8l42.8 0l0 8.1z" />
    </symbol>
  </svg>`;
