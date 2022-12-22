/**
* create pathData from d attribute
**/
function parseDtoPathData(d, normalize = false) {
    // sanitize d string
    let commands = d
      .replace(/[\n\r\t]/g, "")
      .replace(/,/g, " ")
      .replace(/-/g, " -")
      .replace(/(\.)(\d+)(\.)(\d+)/g, "$1$2 $3$4")
      .replace(/( )(0)(\d+)/g, "$1 $2 $3")
      .replace(/([a-z])/gi, "|$1 ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .split("|")
      .filter(Boolean)
      .map((val) => {
        return val.trim();
      });
  
    // compile pathData
    let pathData = [];
  
    for (let i = 0; i < commands.length; i++) {
      let com = commands[i].split(" ");
      let type = com.shift();
      let typeLc = type.toLowerCase();
      let isRelative = type === typeLc ? true : false;
      let values = com.map((val) => {
        return parseFloat(val);
      });
  
      // analyze repeated (shorthanded) commands
      let chunks = [];
      let repeatedType = type;
      // maximum values for a specific command type
      let maxValues = 2;
      switch (typeLc) {
        case "v":
        case "h":
          maxValues = 1;
          if (typeLc === "h") {
            repeatedType = isRelative ? "h" : "H";
          } else {
            repeatedType = isRelative ? "v" : "V";
          }
          break;
        case "m":
        case "l":
        case "t":
          maxValues = 2;
          repeatedType =
            typeLc !== "t" ? (isRelative ? "l" : "L") : isRelative ? "t" : "T";
          /**
           * first starting point should be absolute/uppercase -
           * unless it adds relative linetos
           * (facilitates d concatenating)
           */
          if (typeLc === "m") {
            if (i == 0) {
              type = "M";
            }
          }
          break;
        case "s":
        case "q":
          maxValues = 4;
          repeatedType =
            typeLc !== "q" ? (isRelative ? "s" : "S") : isRelative ? "q" : "Q";
          break;
        case "c":
          maxValues = 6;
          repeatedType = isRelative ? "c" : "C";
          break;
        case "a":
          maxValues = 7;
          repeatedType = isRelative ? "a" : "A";
          break;
        // z closepath
        default:
          maxValues = 0;
      }
  
      // if string contains repeated shorthand commands - split them
      const arrayChunks = (array, chunkSize = 2) => {
        let chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
          let chunk = array.slice(i, i + chunkSize);
          chunks.push(chunk);
        }
        return chunks;
      };
  
      chunks = arrayChunks(values, maxValues);
      // add 1st/regular command
      let chunk0 = chunks.length ? chunks[0] : [];
      pathData.push({ type: type, values: chunk0 });
      // add repeated commands
      if (chunks.length > 1) {
        for (let c = 1; c < chunks.length; c++) {
          pathData.push({ type: repeatedType, values: chunks[c] });
        }
      }
    }
  
    /**
    * normalize to all absolute, cubic, no shorthand
    */
    if (normalize) {
      let pathDataNorm = [];
      pathData = pathDataToLonghands(pathData);
      pathData.forEach((com, i) => {
        let [type, values] = [com.type, com.values];
        let comPrev = i > 0 ? pathData[i - 1] : pathData[i];
        let [typePrev, valuesPrev] = [comPrev.type, comPrev.values];
        let valuesPrevL = valuesPrev.length;
        let p0 = { x: valuesPrev[valuesPrevL - 2], y: valuesPrev[valuesPrevL - 1] };
        switch (type) {
          case 'A':
            let cubicArcs = pathDataArcToCubic(p0, values);
            cubicArcs.forEach(cubicArc=>{
              pathDataNorm.push(cubicArc);
            })
            break;
          case 'Q':
            pathDataNorm.push(pathDataQuadratic2Cubic(p0, values));
            break;
          default:
            pathDataNorm.push(com);
        }
      })
      pathData = pathDataNorm;
    }
    return pathData;
  }


/**
 * convert quadratic commands to cubic
 */
function pathDataQuadratic2Cubic(previous, command) {
    if (Array.isArray(previous)) {
      previous = {
        x: previous[0],
        y: previous[1]
      }
    }
    let cp1 = {
      x: previous.x + 2 / 3 * (command[0] - previous.x),
      y: previous.y + 2 / 3 * (command[1] - previous.y)
    }
    let cp2 = {
      x: command[2] + 2 / 3 * (command[0] - command[2]),
      y: command[3] + 2 / 3 * (command[1] - command[3])
    }
    return ({type: "C", values: [cp1.x, cp1.y, cp2.x, cp2.y, command[2], command[3]]} );
  }
  
  
/**
 * convert arc commands to cubic
 * Based on: Dmitry Baranovskiy's
 * https://github.com/DmitryBaranovskiy/raphael/blob/v2.1.1/dev/raphael.core.js#L1837
 */
  function pathDataArcToCubic(p0, comValues, recursive = false) {  
    if (Array.isArray(p0)) {
      p0 = {
        x: p0[0],
        y: p0[1]
      }
    }
    let [r1, r2, angle, largeArcFlag, sweepFlag, x2, y2] = comValues;
    let [x1, y1] = [p0.x, p0.y];
  
    var degToRad = function (degrees) {
      return (Math.PI * degrees) / 180;
    };
  
    var rotate = function (x, y, angleRad) {
      var X = x * Math.cos(angleRad) - y * Math.sin(angleRad);
      var Y = x * Math.sin(angleRad) + y * Math.cos(angleRad);
      return { x: X, y: Y };
    };
  
    var angleRad = degToRad(angle);
    var params = [];
    var f1, f2, cx, cy;
  
    if (recursive) {
      f1 = recursive[0];
      f2 = recursive[1];
      cx = recursive[2];
      cy = recursive[3];
    }
    else {
      var p1 = rotate(x1, y1, -angleRad);
      x1 = p1.x;
      y1 = p1.y;
  
      var p2 = rotate(x2, y2, -angleRad);
      x2 = p2.x;
      y2 = p2.y;
  
      var x = (x1 - x2) / 2;
      var y = (y1 - y2) / 2;
      var h = (x * x) / (r1 * r1) + (y * y) / (r2 * r2);
  
      if (h > 1) {
        h = Math.sqrt(h);
        r1 = h * r1;
        r2 = h * r2;
      }
  
      var sign;
  
      if (largeArcFlag === sweepFlag) {
        sign = -1;
      }
      else {
        sign = 1;
      }
  
      var r1Pow = r1 * r1;
      var r2Pow = r2 * r2;
  
      var left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
      var right = r1Pow * y * y + r2Pow * x * x;
  
      var k = sign * Math.sqrt(Math.abs(left / right));
  
      cx = k * r1 * y / r2 + (x1 + x2) / 2;
      cy = k * -r2 * x / r1 + (y1 + y2) / 2;
  
      f1 = Math.asin(parseFloat(((y1 - cy) / r2).toFixed(9)));
      f2 = Math.asin(parseFloat(((y2 - cy) / r2).toFixed(9)));
  
      if (x1 < cx) {
        f1 = Math.PI - f1;
      }
      if (x2 < cx) {
        f2 = Math.PI - f2;
      }
  
      if (f1 < 0) {
        f1 = Math.PI * 2 + f1;
      }
      if (f2 < 0) {
        f2 = Math.PI * 2 + f2;
      }
  
      if (sweepFlag && f1 > f2) {
        f1 = f1 - Math.PI * 2;
      }
      if (!sweepFlag && f2 > f1) {
        f2 = f2 - Math.PI * 2;
      }
    }
  
    var df = f2 - f1;
  
    if (Math.abs(df) > (Math.PI * 120 / 180)) {
      var f2old = f2;
      var x2old = x2;
      var y2old = y2;
  
      if (sweepFlag && f2 > f1) {
        f2 = f1 + (Math.PI * 120 / 180) * (1);
      }
      else {
        f2 = f1 + (Math.PI * 120 / 180) * (-1);
      }
  
      x2 = cx + r1 * Math.cos(f2);
      y2 = cy + r2 * Math.sin(f2);
      params = pathDataArcToCubic([x2, y2], [r1, r2, angle, 0, sweepFlag, x2old, y2old], [f2, f2old, cx, cy]);
    }
  
    df = f2 - f1;
  
    var c1 = Math.cos(f1);
    var s1 = Math.sin(f1);
    var c2 = Math.cos(f2);
    var s2 = Math.sin(f2);
    var t = Math.tan(df / 4);
    var hx = 4 / 3 * r1 * t;
    var hy = 4 / 3 * r2 * t;
  
    var m1 = [x1, y1];
    var m2 = [x1 + hx * s1, y1 - hy * c1];
    var m3 = [x2 + hx * s2, y2 - hy * c2];
    var m4 = [x2, y2];
  
    m2[0] = 2 * m1[0] - m2[0];
    m2[1] = 2 * m1[1] - m2[1];
  
    if (recursive) {
      return [m2, m3, m4].concat(params);
    }
    else {
      params = [m2, m3, m4].concat(params);
      let commands = [];
  
      for (var i = 0; i < params.length; i += 3) {
        r1 = rotate(params[i][0], params[i][1], angleRad);
        r2 = rotate(params[i + 1][0], params[i + 1][1], angleRad);
        r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad);
        commands.push({ type: 'C', values: [r1.x, r1.y, r2.x, r2.y, r3.x, r3.y] });
      }
  
      return commands;
    }
  };
  

  
/**
 * decompose/convert shorthands to "longhand" commands:
 * H, V, S, T => L, L, C, Q
 * reversed method: pathDataToShorthands()
 */
function pathDataToLonghands(pathData, decimals = -1) {
    pathData = pathDataToAbsolute(pathData, decimals);
    let pathDataLonghand = [];
    let comPrev = {
        type: "M",
        values: pathData[0].values
    };
    pathDataLonghand.push(comPrev);

    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];
        let type = com.type;
        let values = com.values;
        let valuesL = values.length;
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let [x, y] = [values[valuesL - 2], values[valuesL - 1]];
        let cp1X, cp1Y, cp2X, cp2Y;
        let [prevX, prevY] = [
            valuesPrev[valuesPrevL - 2],
            valuesPrev[valuesPrevL - 1]
        ];
        switch (type) {
            case "H":
                comPrev = {
                    type: "L",
                    values: [values[0], prevY]
                };
                break;
            case "V":
                comPrev = {
                    type: "L",
                    values: [prevX, values[0]]
                };
                break;
            case "T":
                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // new control point
                cpN1X = prevX + (prevX - cp1X);
                cpN1Y = prevY + (prevY - cp1Y);
                comPrev = {
                    type: "Q",
                    values: [cpN1X, cpN1Y, x, y]
                };
                break;
            case "S":
                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [cp2X, cp2Y] =
                    valuesPrevL > 2 ?
                        [valuesPrev[2], valuesPrev[3]] :
                        [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // new control points
                cpN1X = 2 * prevX - cp2X;
                cpN1Y = 2 * prevY - cp2Y;
                cpN2X = values[0];
                cpN2Y = values[1];
                comPrev = {
                    type: "C",
                    values: [cpN1X, cpN1Y, cpN2X, cpN2Y, x, y]
                };

                break;
            default:
                comPrev = {
                    type: type,
                    values: values
                };
        }
        pathDataLonghand.push(comPrev);
    }
    return pathDataLonghand;
}

/**
 * apply shorthand commands if possible
 * L, L, C, Q => H, V, S, T
 * reversed method: pathDataToLonghands()
 */

function pathDataToShorthands(pathData, decimals = -1) {
    pathData = pathDataToAbsolute(pathData);
    let comShort = {
        type: "M",
        values: pathData[0].values
    };
    let pathDataShorts = [comShort];
    for (let i = 1; i < pathData.length; i++) {
        let com = pathData[i];
        let comPrev = pathData[i - 1];
        let type = com.type;
        let values = com.values;
        let valuesL = values.length;
        let valuesPrev = comPrev.values;
        let valuesPrevL = valuesPrev.length;
        let [x, y] = [values[valuesL - 2], values[valuesL - 1]];
        let cp1X, cp1Y, cp2X, cp2Y;
        let [prevX, prevY] = [
            valuesPrev[valuesPrevL - 2],
            valuesPrev[valuesPrevL - 1]
        ];
        let val0R, cpN1XR, val1R, cpN1YR, prevXR, prevYR;

        switch (type) {
            case "L":
                [val0R, prevXR, val1R, prevYR] = [
                    values[0],
                    prevX,
                    values[1],
                    prevY
                ].map((val) => {
                    return +(val * 2).toFixed(1);
                });

                if (prevYR == val1R && prevXR !== val0R) {
                    comShort = {
                        type: "H",
                        values: [values[0]]
                    };
                } else if (prevXR == val0R && prevYR !== val1R) {
                    comShort = {
                        type: "V",
                        values: [values[1]]
                    };
                } else {
                    comShort = com;
                }
                break;
            case "Q":
                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // Q control point
                cpN1X = prevX + (prevX - cp1X);
                cpN1Y = prevY + (prevY - cp1Y);

                /**
                * control points can be reflected
                * use rounded values for better tolerance
                */
                [val0R, cpN1XR, val1R, cpN1YR] = [
                    values[0],
                    cpN1X,
                    values[1],
                    cpN1Y
                ].map((val) => {
                    return +(val * 1).toFixed(1);
                });

                if (val0R == cpN1XR && val1R == cpN1YR) {
                    comShort = {
                        type: "T",
                        values: [x, y]
                    };
                } else {
                    comShort = com;
                }
                break;
            case "C":
                [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                [cp2X, cp2Y] =
                    valuesPrevL > 2 ?
                        [valuesPrev[2], valuesPrev[3]] :
                        [valuesPrev[0], valuesPrev[1]];
                [prevX, prevY] = [
                    valuesPrev[valuesPrevL - 2],
                    valuesPrev[valuesPrevL - 1]
                ];
                // C control points
                cpN1X = 2 * prevX - cp2X;
                cpN1Y = 2 * prevY - cp2Y;
                cpN2X = values[2];
                cpN2Y = values[3];

                /**
                * control points can be reflected
                * use rounded values for better tolerance
                */
                [val0R, cpN1XR, val1R, cpN1YR] = [
                    values[0],
                    cpN1X,
                    values[1],
                    cpN1Y
                ].map((val) => {
                    return +(val * 3).toFixed(0);
                });

                if (val0R == cpN1XR && val1R == cpN1YR) {
                    comShort = {
                        type: "S",
                        values: [cpN2X, cpN2Y, x, y]
                    };
                } else {
                    comShort = com;
                }
                break;
            default:
                comShort = {
                    type: type,
                    values: values
                };
        }
        pathDataShorts.push(comShort);
    }
    return pathDataShorts;
}


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

function setPathDataOpt(path, pathData, decimals=-1) {
    let d = "";
    pathData.forEach((com, c) => {
      if (decimals >= 0) {
        com.values.forEach(function (val, v) {
          pathData[c]["values"][v] = +val.toFixed(decimals);
        });
      }
      d += `${com.type}${com.values.join(" ")}`;
    });
    d = d.replaceAll(",", " ").replaceAll(" -", "-");
    path.setAttribute("d", d);
}

function roundPathDataOpt(pathData, decimals=-1) {
    pathData.forEach((com, c) => {
      if (decimals >= 0) {
        com.values.forEach(function (val, v) {
          pathData[c]["values"][v] = +val.toFixed(decimals);
        });
      }
    });
    return pathData;
}
