function flattenSVGTransformations(svg, options={decomposeNested: false, decomposeUse: false }) {
    //decompose nested svgs and use instances
    if (options.decomposeNested) {
        decomposeNestedSvgs(svg)
    }
    if (options.decomposeUse) {
        decomposeUseEls(svg);
    }

    let els = svg.querySelectorAll('text, path, polyline, polygon, line, rect, circle, ellipse');
    els.forEach(el => {
        if (el instanceof SVGGeometryElement && el.nodeName !== 'path') {
            el = el.convertPrimitiveToPath({ relative: true, decimals: -1 });
        }
        reduceElementTransforms(el);
    });

    // remove group transforms
    let groups = svg.querySelectorAll('g');
    groups.forEach(g => {
        g.removeAttribute('transform');
        g.removeAttribute('transform-origin');
        g.style.removeProperty('transform');
        g.style.removeProperty('transform-origin');
    });
}


function reduceElementTransforms(el, decimals = 3) {
    let parent = el.farthestViewportElement;

    // check elements transformations
    let matrix = parent.getScreenCTM().inverse().multiply(el.getScreenCTM());
    let { a, b, c, d, e, f } = matrix;

    // round matrix
    [a, b, c, d, e, f] = [a, b, c, d, e, f].map(val => { return +val.toFixed(3) });
    let matrixStr = [a, b, c, d, e, f].join('');
    let isTransformed = matrixStr !== "100100" ? true : false;

    if (isTransformed) {

        // matrix to readable transfomr functions
        let transObj = qrDecomposeMatrix(matrix);

        // scale stroke-width
        let scale = (transObj.scaleX + transObj.scaleY) / 2;
        scaleStrokeWidth(el, scale)


        // if text element: consolidate all applied transforms 
        if (el instanceof SVGGeometryElement === false) {
            if (isTransformed) {
                el.setAttribute('transform', transObj.svgTransform);
                el.removeAttribute('transform-origin');
                el.style.removeProperty('transform');
                el.style.removeProperty('transform-origin');
            }
            return false
        }


        /**
         * is geometry elements: 
         * recalculate pathdata
         * according to transforms
         * by matrix transform
         */

        let pathData = el.getPathDataOpt({ normalize: true });

        let svg = el.closest("svg");
        pathData.forEach((com, i) => {
            let values = com.values;
            for (let v = 0; v < values.length - 1; v += 2) {
                let [x, y] = [values[v], values[v + 1]];
                let pt = svg.createSVGPoint();
                pt.x = x;
                pt.y = y;

                let pTrans = pt.matrixTransform(matrix);

                // update coordinates in pathdata array
                pathData[i]["values"][v] = +(pTrans.x).toFixed(decimals);
                pathData[i]["values"][v + 1] = +(pTrans.y).toFixed(decimals);
            }
        });

        // apply pathdata - remove transform
        el.setAttribute('d', pathDataToD(pathData, decimals));
        el.removeAttribute('transform');
        el.style.removeProperty('transform');


        return pathData;
    }

}


function scaleStrokeWidth(el, scale) {
    let styles = window.getComputedStyle(el);
    let strokeWidth = styles.getPropertyValue('stroke-width');
    let stroke = styles.getPropertyValue('stroke');
    strokeWidth = stroke != 'none' ? parseFloat(strokeWidth) * scale : 0;

    // exclude text elements, since they remain transformed
    if (strokeWidth && el.nodeName.toLowerCase() !== 'text') {
        el.setAttribute('stroke-width', strokeWidth);
        el.style.removeProperty('stroke-width');
    }
}



/**
 *  Decompose matrix to readable transform properties 
 *  translate() rotate() scale() etc.
 *  based on @AndreaBogazzi's answer
 *  https://stackoverflow.com/questions/5107134/find-the-rotation-and-skew-of-a-matrix-transformation#32125700
 *  return object with seperate transform properties 
 *  and ready to use css or svg attribute strings
 */
function qrDecomposeMatrix(matrix, precision = 3) {
    let {
        a,
        b,
        c,
        d,
        e,
        f
    } = matrix;
    // matrix is array
    if (Array.isArray(matrix)) {
        [a, b, c, d, e, f] = matrix;
    }

    let angle = Math.atan2(b, a),
        denom = Math.pow(a, 2) + Math.pow(b, 2),
        scaleX = Math.sqrt(denom),
        scaleY = (a * d - c * b) / scaleX,
        skewX = Math.atan2(a * c + b * d, denom) / (Math.PI / 180),
        translateX = e ? e : 0,
        translateY = f ? f : 0,
        rotate = angle ? angle / (Math.PI / 180) : 0;
    let transObj = {
        translateX: translateX,
        translateY: translateY,
        rotate: rotate,
        scaleX: scaleX,
        scaleY: scaleY,
        skewX: skewX,
        skewY: 0
    };

    let cssTransforms = [];
    let svgTransforms = [];
    for (let prop in transObj) {
        transObj[prop] = +parseFloat(transObj[prop]).toFixed(precision);
        let val = transObj[prop];
        let unit = "";
        if (prop == "rotate" || prop == "skewX") {
            unit = "deg";
        }
        if (prop.indexOf("translate") != -1) {
            unit = "px";
        }

        // combine these properties
        let convert = ["scaleX", "scaleY", "translateX", "translateY"];

        if (val !== 0) {
            cssTransforms.push(`${prop}(${val}${unit})`);
        }

        if (convert.indexOf(prop) == -1 && val !== 0) {
            svgTransforms.push(`${prop}(${val})`);
        } else if (prop == "scaleX") {
            svgTransforms.push(
                `scale(${+scaleX.toFixed(precision)} ${+scaleY.toFixed(precision)})`
            );
        } else if (prop == "translateX") {
            svgTransforms.push(
                `translate(${transObj.translateX} ${transObj.translateY})`
            );
        }

    }
    // append css style string to object
    transObj.cssTransform = cssTransforms.join(" ");
    transObj.svgTransform = svgTransforms.join(" ");
    return transObj;
}






/**
 * convert percentage values
 * to svg user units
 */

function percentageToAbsolute(svg) {
    let els = svg.querySelectorAll('*');
    els.forEach(el => {
        let atts = [...el.attributes];
        for (let prop in atts) {
            let attName = atts[prop].nodeName;
            let val = atts[prop].value;
            let valStr = val.toString();

            // find base to relative units
            if (attName !== 'style' && valStr.indexOf('%') !== -1) {
                let ref = '';
                let parentSvg = el.parentNode.closest('svg');
                let parentSymbol = el.parentNode.closest('symbol');
                let parent = parentSymbol ? parentSymbol : parentSvg;

                let vB = parent.getAttribute('viewBox');
                vB = vB ? vB.split(/[ ,]+/) : [];
                let [width, height] = vB.length ? [vB[2], vB[3]] : [];

                if (!width && !height) {
                    let style = window.getComputedStyle(el);
                    [width, height] = [style.width, style.height];
                }

                // relative to absolute
                let valNum = parseFloat(val);
                let verticalAtts = ['y', 'y1', 'y2', 'ry', 'cy', 'height'];
                let scale = verticalAtts.includes(attName) ? height / 100 : width / 100;
                let abs = scale * valNum;

                atts[prop].value = abs;
            }
        }
    });
}

/**
 * get element transforms
 */

function getElementTransform(el, parent, precision = 6) {
    let matrix = parent.getScreenCTM().inverse().multiply(el.getScreenCTM());
    let matrixVals = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].map(val => {
        return +val.toFixed(precision)
    });
    return matrixVals;
}

/**
 * decompose nested svgs
 * to groups
 */

function decomposeNestedSvgs(svg) {
    let svgs = [svg];
    let nested = svg.querySelectorAll('svg');
    nested.forEach(el=>{
        svgs.push(el)
    })
    // all transformations to matrix()
    svgs.forEach(function (svg) {
        percentageToAbsolute(svg);
        let children = [...svg.children];
        children.forEach(function (child) {
            //transFormToMatrix(child);
            if (child instanceof SVGGeometryElement) {
                let matrix = getElementTransform(child, svg);
                //let matrix = getElementTransform(child, parentSVG);
                
                if(matrix.join(',') !=='1,0,0,1,0,0'){
                    child.setAttribute('transform', `matrix( ${matrix} )`);
                    child.removeAttribute('transform-origin');
                    child.style.removeProperty('transform-origin');
                }
            }
        });
    })
    // nested to groups
    nested.forEach(function (svg) {
        nestedSvgToGroup(svg);
    })
}


function nestedSvgToGroup(svg) {
    let svgSub = svg;
    if (svg.parentNode) {
        let parent = svg.parentNode.closest('svg');
        let svgSubChildren = [...svgSub.children];
        let groupMatrix = getElementTransform(svgSub, parent);
        
        //replace nested svg with group - apply matrix
        let group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('svgNested');
        group.setAttribute('transform', `matrix( ${groupMatrix} )`);

        //copy children to group
        svgSubChildren.forEach(function (child, i) {
            group.appendChild(child);
        })
        //remove nested svg
        svgSub.replaceWith(group);
    }
}


/**
 * decompose use instances
 */


function decomposeUseEls(svg) {
    percentageToAbsolute(svg);
    let useEls = svg.querySelectorAll('use');
    let ns = 'http://www.w3.org/2000/svg';
    let viewBox = svg.getAttribute('viewBox');
    let [w,h] = viewBox ? [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height] : [0,0];
    let symbols = [];

    if (useEls.length) {
        useEls.forEach(use => {
            let href = use.getAttribute('href');
            //let atts = [...use.attributes];
            //console.log(atts)
            let symbol = svg.getElementById(href.replaceAll('#', ''));
            symbols.push(symbol)

            // use boundaries
            let bb = use.getBBox();
            let {x, y, width, height} = bb;

            let vB = symbol.getAttribute('viewBox');
            vB = vB ? vB.split(' ') : [];
            let [vBw, vBh] = vB.length ? [+vB[2], +vB[3]] : [0, 0];

            
            // svg width / symbol width
            let scale = vBh ? (w > h ? h/vBh : w/vBw) : 1;
            let matrix = getElementTransform(use, svg);

            // create group 
            let group = document.createElementNS(ns, 'g');
            group.classList.add('useGroup');


            // copy use attributes
            copyAttributes(use, group);
            group.setAttribute('transform', ` matrix(${matrix}) translate(${x} ${y}) scale(${scale})`);
            group.innerHTML = symbol.innerHTML;

            // remove use elements and append group
            svg.insertBefore(group, use.nextElementSibling);
            use.remove();

        })
    }

    // remove symbols or defs
    symbols.forEach(symbol=>{
        if(symbol){
            symbol.remove();
        }
    })
}



function copyAttributes(el, newEl){
    let atts = [...el.attributes];
    let excludedAtts = ['d', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx',
        'ry', 'points', 'height', 'width'
    ];
    for (let a = 0; a < atts.length; a++) {
        let att = atts[a];
        if (excludedAtts.indexOf(att.nodeName) === -1) {
            let attrName = att.nodeName;
            let attrValue = att.nodeValue;
            newEl.setAttribute(attrName, attrValue + '');
        }
    }
}
