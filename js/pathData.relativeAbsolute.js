/**
 * Convert svg paths using the upcoming getPathData() method
 * which is expected to be natively supported by browsers
 * and the successors of the deprecated pathSegList() methods
 * 
 * Based on the svg working draft 
 * https://svgwg.org/specs/paths/#InterfaceSVGPathData
 * 
 * Dependency: 
 * Use Jarek Foksa's polyfill
 * https://github.com/jarek-foksa/path-data-polyfill
 * Usage via cdn:
 * CDN: https://cdn.jsdelivr.net/npm/path-data-polyfill@latest/path-data-polyfill.min.js
 * 
 * Svg coordinate calculation:
 * This is just a dull port of Dmitry Baranovskiy's 
 * pathToRelative/Absolute methods used in snap.svg
 * https://github.com/adobe-webplatform/Snap.svg/
 * 
 * Demo: https://codepen.io/herrstrietzel/pen/poVKbgL
 */

/**
 * example usage: 
let svg = document.querySelector('svg');
let path = svg.querySelector('path');
let pathData = path.getPathData();
// 2nd argument defines optional rounding: -1 == no rounding; 2 == round to 2 decimals
let pathDataRel = pathDataToRelative(pathData, 3);
path.setPathData(pathDataRel);
*/

// convert to relative commands
function pathDataToRelative(pathData, decimals = -1, unlink = false) {
    // remove object reference
    pathData = unlink ? JSON.parse(JSON.stringify(pathData)) : pathData;

    let M = pathData[0].values;
    let x = M[0],
        y = M[1],
        mx = x,
        my = y;
    // loop through commands
    for (let i = 1; i < pathData.length; i++) {
        let cmd = pathData[i];
        let type = cmd.type;
        let typeRel = type.toLowerCase();
        let values = cmd.values;

        // is absolute
        if (type != typeRel) {
            type = typeRel;
            cmd.type = type;
            // check current command types
            switch (typeRel) {
                case "a":
                    values[5] = +(values[5] - x);
                    values[6] = +(values[6] - y);
                    break;
                case "v":
                    values[0] = +(values[0] - y);
                    break;
                case "m":
                    mx = values[0];
                    my = values[1];
                default:
                    // other commands
                    if (values.length) {
                        for (let v = 0; v < values.length; v++) {
                            // even value indices are y coordinates
                            values[v] = values[v] - (v % 2 ? y : x);
                        }
                    }
            }
        }
        // is already relative
        else {
            if (cmd.type == "m") {
                mx = values[0] + x;
                my = values[1] + y;
            }
        }
        let vLen = values.length;
        switch (type) {
            case "z":
                x = mx;
                y = my;
                break;
            case "h":
                x += values[vLen - 1];
                break;
            case "v":
                y += values[vLen - 1];
                break;
            default:
                x += values[vLen - 2];
                y += values[vLen - 1];
        }

        // round coordinates
        if (decimals >= 0) {
            cmd.values = values.map((val) => {
                return +val.toFixed(decimals);
            });
        }
    }
    // round M (starting point)
    if (decimals >= 0) {
        [M[0], M[1]] = [+M[0].toFixed(decimals), +M[1].toFixed(decimals)];
    }
    return pathData;
}

function pathDataToAbsolute(pathData, decimals = -1, unlink = false) {
    // remove object reference
    pathData = unlink ? JSON.parse(JSON.stringify(pathData)) : pathData;

    let M = pathData[0].values;
    let x = M[0],
        y = M[1],
        mx = x,
        my = y;
    // loop through commands
    for (let i = 1; i < pathData.length; i++) {
        let cmd = pathData[i];
        let type = cmd.type;
        let typeAbs = type.toUpperCase();
        let values = cmd.values;

        if (type != typeAbs) {
            type = typeAbs;
            cmd.type = type;
            // check current command types
            switch (typeAbs) {
                case "A":
                    values[5] = +(values[5] + x);
                    values[6] = +(values[6] + y);
                    break;

                case "V":
                    values[0] = +(values[0] + y);
                    break;

                case "H":
                    values[0] = +(values[0] + x);
                    break;

                case "M":
                    mx = +values[0] + x;
                    my = +values[1] + y;

                default:
                    // other commands
                    if (values.length) {
                        for (let v = 0; v < values.length; v++) {
                            // even value indices are y coordinates
                            values[v] = values[v] + (v % 2 ? y : x);
                        }
                    }
            }
        }
        // is already absolute
        let vLen = values.length;
        switch (type) {
            case "Z":
                x = +mx;
                y = +my;
                break;
            case "H":
                x = values[0];
                break;
            case "V":
                y = values[0];
                break;
            case "M":
                mx = values[vLen - 2];
                my = values[vLen - 1];

            default:
                x = values[vLen - 2];
                y = values[vLen - 1];
        }

        // round coordinates
        if (decimals >= 0) {
            cmd.values = values.map((val) => {
                return +val.toFixed(decimals);
            });
        }
    }
    // round M (starting point)
    if (decimals >= 0) {
        [M[0], M[1]] = [+M[0].toFixed(decimals), +M[1].toFixed(decimals)];
    }
    return pathData;
}