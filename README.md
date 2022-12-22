# svgHelpers
Just a collection of svg javaScript helpers based on the official draft of the [SVG Paths specification](https://svgwg.org/specs/paths/#InterfaceSVGPathData) introducing the `getPathData()` and `setPathData()` methods.

Currently `getPathData()` is not natively supported by any major browser, thus you need a polyfill like [Jarek Foksa's path-data-polyfill](https://github.com/jarek-foksa/path-data-polyfill).

## Setup/dependencies
Include the aforementioned [polyfill by Jarek Foksa](https://github.com/jarek-foksa/path-data-polyfill) either by downloading the current version or via **cdn** like so:   

```html
<script src="https://cdn.jsdelivr.net/npm/path-data-polyfill@latest/path-data-polyfill.min.js"></script>
```

<details>
<summary><h2>About getPathData(), setPathData() – methodology</h2></summary> 

`getPathData()` parses an existing SVG element to an array of command objects like this:  

```svg
<svg>
   <path id="path1" d="M 0 50 L 50 50 L 50 100 L 0 100 z" />
</svg>
```  

### Parse pathData   
```js
let pathData = path1.getPathData();
```

returns this array:  
```js
[
  { type: "M", values: [0, 50] },
  { type: "L", values: [50, 50] },
  { type: "L", values: [50, 100] },
  { type: "L", values: [0, 100] },
  { type: "Z", values: [] }
];
```
reapply to path `d` attribute
```js
path1.setPathData(pathData);
```
</details>


## Usage examples

### 1. Convert path commands to all relative or absolute

#### pathData.relativeAbsolute.js 
    <script src="https://cdn.jsdelivr.net/gh/herrstrietzel/svgHelpers@main/js/pathData.relativeAbsolute.min.js"></script>

#### Arguments:
* pathData
* decimals (optional): round to floating point decimals (-1 disables rounding)
* unlink (optiona)l: creates a seperated pathData copy  

**All relative**  
```js
let pathData = path.getPathData();
let pathDataRelative = pathDataToRelative(pathData);
path1.setPathData(pathDataRelative);
```

**All absolute**  
```js
let pathData = path.getPathData();
let pathDataAbsolute = pathDataToAbsolute(pathData);
path1.setPathData(pathDataAbsolute);
```


### 2. Convert path commands to "longhand" or reapply shorthand commands

All Shorthand commands `V`, `H`, `S`, `Q` will be converted to their longhand counterparts  
`L`, `C`, `Q`.

#### pathData.shorthands.js 
    <script src="https://cdn.jsdelivr.net/gh/herrstrietzel/svgHelpers@latest/js/pathData.shorthands.min.js"></script>
    
##### Arguments:
* pathData
* decimals (optional): round to floating point decimals (-1 disables rounding)

##### Dependancies: pathData.relativeAbsolute.js 

#### All longhand commands

```js
let pathData = path.getPathData();
let pathDataLonghands = pathDataToLonghands(pathData);
path.setPathData(pathDataLonghands);
```

#### Apply shorthand commands

Will try to apply shorthand commands - if applicable.

```js
let pathData = path.getPathData();
let pathDataShorthands = pathDataToShorthands(pathData);
path.setPathData(pathDataShorthands);
```

### 3. Parse `<path>` `d` attribute to pathData array 

1. parseDtoPathData(d);  
2. setPathDataOpt(path, pathData, decimals=-1);  
3. roundPathData(pathData, decimals=-1)  

```js
// parse to pathData array
let d = path.getAttribute('d');
let pathData = parseDtoPathData(d);

// set path `d` - apply rounding
setPathDataOpt(path, pathData, 3);
```

#### Aguments
* path element `d` attribute
* normalize (optional): Boolean

```js
let d = path.getAttribute('d');
let pathData = parseDtoPathData(d, true);
```

Normalize option converts all commands like the official `getPathData({normalize:true})`:  
* all absolute
* convert shorthands to longhand notation
* convert quadratic `Q` and arc `A` commands to cubic `C`

#### Dependancies: self-contained
This script included helper functions from  
* pathData.relativeAbsolute.js
* pathData.shorthands.js

#### pathData.parseAndConvert.js
```html
<script src="https://cdn.jsdelivr.net/gh/herrstrietzel/svgHelpers@latest/js/pathData.parseAndConvert.js"></script>
```


