
/**
 * reverse pathdata
 */
function reversePathData(pathData, decimals = -1) {
    /**
     * make sure all command coordinates are absolute and
     * shorthands are converted to long notation
     */
    pathData = pathDataToLonghands(pathDataToAbsolute(pathData, decimals));

    // split to sub path array
    let pathDataArray = splitSubpaths(pathData);

    // start compiling new path data
    let pathDataNew = [];

    // helper to rearrange control points for all command types
    const reverseControlPoints = (type, values) => {
        let controlPoints = [];
        let endPoint = [];
        if (type !== "A") {
            for (let p = 0; p < values.length; p += 2) {
                controlPoints.push([values[p], values[p + 1]]);
            }
            endPoint = controlPoints.pop();
            controlPoints.reverse();
        }
        // is arc
        else {
            //reverse sweep;
            let sweep = values[4] == 0 ? 1 : 0;
            controlPoints = [values[0], values[1], values[2], values[3], sweep];
            endPoint = [values[5], values[6]];
        }
        return [controlPoints, endPoint];
    };

    pathDataArray.forEach((pathData) => {
        let closed =
            pathData[pathData.length - 1].type.toLowerCase() === "z" ? true : false;
        if (closed) {
            // add lineto closing space between Z and M
            pathData = addClosePathLineto(pathData);
            // remove Z closepath
            pathData.pop();
        }

        // define last point as new M if path isn't closed
        let valuesLast = pathData[pathData.length - 1].values;
        let valuesLastL = valuesLast.length;
        let M = closed
            ? pathData[0]
            : {
                type: "M",
                values: [valuesLast[valuesLastL - 2], valuesLast[valuesLastL - 1]]
            };
        // starting M stays the same – unless the path is not closed
        pathDataNew.push(M);

        // reverse path data command order for processing
        pathData.reverse();
        for (let i = 1; i < pathData.length; i++) {
            let com = pathData[i];
            let type = com.type;
            let values = com.values;
            let valuesL = values.length;
            let comPrev = pathData[i - 1];
            let typePrev = comPrev.type;
            let valuesPrev = comPrev.values;
            // get reversed control points and new end coordinates
            let [controlPointsPrev, endPointsPrev] = reverseControlPoints(
                typePrev,
                valuesPrev
            );
            let [controlPoints, endPoints] = reverseControlPoints(type, values);

            // create new path data
            let newValues = [];
            newValues = controlPointsPrev.flat().concat(endPoints);
            pathDataNew.push({
                type: typePrev,
                values: newValues
            });
        }

        // add previously removed Z close path
        if (closed) {
            pathDataNew.push({
                type: "z",
                values: []
            });
        }
    });
    return pathDataNew;
}


/**
 * Add closing lineto:
 * needed for path reversing or adding points
 */
function addClosePathLineto(pathData) {
    let pathDataL = pathData.length;
    let closed = pathData[pathDataL - 1]["type"] == "Z" ? true : false;

    let M = pathData[0];
    let [x0, y0] = [M.values[0], M.values[1]];
    let lastCom = closed ? pathData[pathDataL - 2] : pathData[pathDataL - 1];
    let lastComL = lastCom.values.length;
    let [xE, yE] = [lastCom.values[lastComL - 2], lastCom.values[lastComL - 1]];
    if (closed && (x0 != xE || y0 != yE)) {
        pathData.pop();
        pathData.push(
            {
                type: "L",
                values: [x0, y0]
            },
            {
                type: "Z",
                values: []
            }
        );
    }
    return pathData;
}


/**
 * split compound paths into sub path data array
 */
function splitSubpaths(pathData) {
    let subPathArr = [];
    let subPathMindex = [];
    pathData.forEach((com, i) => {
        let type = com.type;
        if (type == "M") {
            subPathMindex.push(i);
        }
    });
    //split segments after M command
    subPathMindex.forEach((index, i) => {
        let n = subPathMindex[i + 1];
        let thisSeg = pathData.slice(index, n);
        subPathArr.push(thisSeg);
    });
    return subPathArr;
}
