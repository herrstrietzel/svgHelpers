/**
* convert Arcs to quadratic
* or cubic beziers
* recommended angle threshhold for quadratic: 22.5
*/
  function arcCommandToBezier(p0, comValues, quadratic=false, angleThresh = 90, recursive = false) {
    let [r1, r2, angle, largeArcFlag, sweepFlag, x2, y2] = comValues;
    let [x1, y1] = [p0.x, p0.y];
    const interpolate = (p1x, p1y, p2x, p2y, t) => {
      let pt = {
        x: (p2x - p1x) * t + p1x,
        y: (p2y - p1y) * t + p1y
      };
      return pt
    }
    const degToRad = (degrees) => {
      return (Math.PI * degrees) / 180;
    };
    const rotate = (x, y, angleRad) => {
      let X = x * Math.cos(angleRad) - y * Math.sin(angleRad);
      let Y = x * Math.sin(angleRad) + y * Math.cos(angleRad);
      return {
        x: X,
        y: Y
      };
    };
    let angleRad = degToRad(angle);
    let params = [];
    let x, y, f1, f2, cx, cy, h;
    if (recursive) {
      f1 = recursive[0];
      f2 = recursive[1];
      cx = recursive[2];
      cy = recursive[3];
    } else {
      let p1 = rotate(x1, y1, -angleRad);
      x1 = p1.x;
      y1 = p1.y;
      let p2 = rotate(x2, y2, -angleRad);
      x2 = p2.x;
      y2 = p2.y;
      x = (x1 - x2) / 2;
      y = (y1 - y2) / 2;
      h = (x * x) / (r1 * r1) + (y * y) / (r2 * r2);
      if (h > 1) {
        h = Math.sqrt(h);
        r1 = h * r1;
        r2 = h * r2;
      }
      let sign = largeArcFlag === sweepFlag ? -1 : 1;
      let r1Pow = r1 * r1;
      let r2Pow = r2 * r2;
      let left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
      let right = r1Pow * y * y + r2Pow * x * x;
      let k = sign * Math.sqrt(Math.abs(left / right));
      cx = (k * r1 * y) / r2 + (x1 + x2) / 2;
      cy = (k * -r2 * x) / r1 + (y1 + y2) / 2;
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
    let df = f2 - f1;
    if (Math.abs(df) > (Math.PI * angleThresh) / 180) {
      let f2old = f2;
      let x2old = x2;
      let y2old = y2;
      f2 =
        sweepFlag && f2 > f1 ?
        (f2 = f1 + ((Math.PI * angleThresh) / 180) * 1) :
        (f2 = f1 + ((Math.PI * angleThresh) / 180) * -1);
      x2 = cx + r1 * Math.cos(f2);
      y2 = cy + r2 * Math.sin(f2);
      params = arcCommandToBezier({
          x: x2,
          y: y2
        },
        [r1, r2, angle, 0, sweepFlag, x2old, y2old],
quadratic,
        angleThresh,
        [f2, f2old, cx, cy]
      );
    }
    df = f2 - f1;
    let c1 = Math.cos(f1);
    let s1 = Math.sin(f1);
    let c2 = Math.cos(f2);
    let s2 = Math.sin(f2);
    let t = Math.tan(df / 4);
    let hx = (4 / 3) * r1 * t;
    let hy = (4 / 3) * r2 * t;
    let m1 = [x1, y1];
    let m2 = [x1 + hx * s1, y1 - hy * c1];
    let m3 = [x2 + hx * s2, y2 - hy * c2];
    let m4 = [x2, y2];
    m2[0] = 2 * m1[0] - m2[0];
    m2[1] = 2 * m1[1] - m2[1];
    if (recursive) {
      return [m2, m3, m4].concat(params);
    } else {
      params = [m2, m3, m4].concat(params);
      let commands = [];
      for (var i = 0; i < params.length; i += 3) {
        r1 = rotate(params[i][0], params[i][1], angleRad);
        r2 = rotate(params[i + 1][0], params[i + 1][1], angleRad);
        r3 = rotate(params[i + 2][0], params[i + 2][1], angleRad);
        let cp1Q = interpolate(r3.x, r3.y, r2.x, r2.y, 3 / 2)
        if(quadratic){
          commands.push({
            type: 'Q',
            values: [cp1Q.x, cp1Q.y, r3.x, r3.y]
          })          
        }else{
          commands.push({
            type: "C",
            values: [r1.x, r1.y, r2.x, r2.y, r3.x, r3.y]
          });
        }
      }
      return commands;
    }
  }



/**
 * fontello/cubic2quad
 * https://github.com/fontello/cubic2quad/blob/master/test/cubic2quad.js
 */
var epsilon = 1e-16;

function Point(n, t) {
  (this.x = n), (this.y = t);
}

function calcPowerCoefficients(n, t, i, o) {
  return [
    o.sub(n).add(t.sub(i).mul(3)),
    n.add(i).mul(3).sub(t.mul(6)),
    t.sub(n).mul(3),
    n
  ];
}

function calcPowerCoefficientsQuad(n, t, i) {
  return [t.mul(-2).add(n).add(i), t.sub(n).mul(2), n];
}

function calcPoint(n, t, i, o, r) {
  return n.mul(r).add(t).mul(r).add(i).mul(r).add(o);
}

function calcPointQuad(n, t, i, o) {
  return n.mul(o).add(t).mul(o).add(i);
}

function calcPointDerivative(n, t, i, o, r) {
  return n
    .mul(3 * r)
    .add(t.mul(2))
    .mul(r)
    .add(i);
}

function quadSolve(n, t, i) {
  if (0 === n) return 0 === t ? [] : [-i / t];
  var o = t * t - 4 * n * i;
  if (Math.abs(o) < epsilon) return [-t / (2 * n)];
  if (o < 0) return [];
  var r = Math.sqrt(o);
  return [(-t - r) / (2 * n), (-t + r) / (2 * n)];
}

function minDistanceToLineSq(n, t, i) {
  var o = i.sub(t),
    r = n.sub(t).dot(o),
    e = o.sqr(),
    u = 0;
  return (
    0 !== e && (u = r / e),
    (u <= 0 ? n.sub(t) : u >= 1 ? n.sub(i) : n.sub(t.add(o.mul(u)))).sqr()
  );
}

function processSegment(n, t, i, o, r, e) {
  var u = calcPoint(n, t, i, o, r),
    a = calcPoint(n, t, i, o, e),
    c = calcPointDerivative(n, t, i, o, r),
    s = calcPointDerivative(n, t, i, o, e),
    f = -c.x * s.y + s.x * c.y;
  return Math.abs(f) < 1e-8 ? [u, u.add(a).div(2), a] : [
    u,
    new Point(
      (c.x * (a.y * s.x - a.x * s.y) + s.x * (u.x * c.y - u.y * c.x)) / f,
      (c.y * (a.y * s.x - a.x * s.y) + s.y * (u.x * c.y - u.y * c.x)) / f
    ),
    a
  ];
}

function isSegmentApproximationClose(n, t, i, o, r, e, u, a, c, s) {
  var f,
    l,
    d,
    h,
    p,
    y,
    P = calcPowerCoefficientsQuad(u, a, c),
    m = P[0],
    x = P[1],
    b = P[2],
    v = s * s,
    w = [],
    g = [];
  for (l = (e - r) / 10, d = 0, f = r; d <= 10; d++, f += l)
    w.push(calcPoint(n, t, i, o, f));
  for (l = 0.1, d = 0, f = 0; d <= 10; d++, f += l)
    g.push(calcPointQuad(m, x, b, f));
  for (d = 1; d < w.length - 1; d++) {
    for (y = 1 / 0, h = 0; h < g.length - 1; h++)
      (p = minDistanceToLineSq(w[d], g[h], g[h + 1])), (y = Math.min(y, p));
    if (y > v) return !1;
  }
  for (d = 1; d < g.length - 1; d++) {
    for (y = 1 / 0, h = 0; h < w.length - 1; h++)
      (p = minDistanceToLineSq(g[d], w[h], w[h + 1])), (y = Math.min(y, p));
    if (y > v) return !1;
  }
  return !0;
}

function _isApproximationClose(n, t, i, o, r, e) {
  for (var u = 1 / r.length, a = 0; a < r.length; a++) {
    if (!isSegmentApproximationClose(
        n,
        t,
        i,
        o,
        a * u,
        (a + 1) * u,
        r[a][0],
        r[a][1],
        r[a][2],
        e
      ))
      return !1;
  }
  return !0;
}

function fromFlatArray(n) {
  for (var t = [], i = (n.length - 2) / 4, o = 0; o < i; o++)
    t.push([
      new Point(n[4 * o], n[4 * o + 1]),
      new Point(n[4 * o + 2], n[4 * o + 3]),
      new Point(n[4 * o + 4], n[4 * o + 5])
    ]);
  return t;
}

function toFlatArray(n) {
  var t = [];
  t.push(n[0][0].x), t.push(n[0][0].y);
  for (var i = 0; i < n.length; i++)
    t.push(n[i][1].x), t.push(n[i][1].y), t.push(n[i][2].x), t.push(n[i][2].y);
  return t;
}

function isApproximationClose(n, t, i, o, r, e, u, a, c, s) {
  var f = calcPowerCoefficients(
    new Point(n, t),
    new Point(i, o),
    new Point(r, e),
    new Point(u, a)
  );
  return _isApproximationClose(f[0], f[1], f[2], f[3], fromFlatArray(c), s);
}

function subdivideCubic(n, t, i, o, r, e, u, a, c) {
  var s = 1 - c,
    f = n * s + i * c,
    l = i * s + r * c,
    d = r * s + u * c,
    h = f * s + l * c,
    p = l * s + d * c,
    y = h * s + p * c,
    P = t * s + o * c,
    m = o * s + e * c,
    x = e * s + a * c,
    b = P * s + m * c,
    v = m * s + x * c,
    w = b * s + v * c;
  return [
    [n, t, f, P, h, b, y, w],
    [y, w, p, v, d, x, u, a]
  ];
}

function byNumber(n, t) {
  return n - t;
}

function solveInflections(n, t, i, o, r, e, u, a) {
  return quadSolve(-u * (t - 2 * o + e) +
      r * (2 * t - 3 * o + a) +
      n * (o - 2 * e + a) -
      i * (t - 3 * e + 2 * a),
      u * (t - o) +
      3 * r * (-t + o) +
      i * (2 * t - 3 * e + a) -
      n * (2 * o - 3 * e + a),
      r * (t - o) + n * (o - e) + i * (-t + e)
    )
    .filter(function(n) {
      return n > 1e-8 && n < 1 - 1e-8;
    })
    .sort(byNumber);
}

function _cubicToQuad(n, t, i, o, r, e, u, a, c) {
  for (
    var s,
      f = new Point(n, t),
      l = new Point(i, o),
      d = new Point(r, e),
      h = new Point(u, a),
      p = calcPowerCoefficients(f, l, d, h),
      y = p[0],
      P = p[1],
      m = p[2],
      x = p[3],
      b = 1; b <= 8; b++
  ) {
    s = [];
    for (var v = 0; v < 1; v += 1 / b)
      s.push(processSegment(y, P, m, x, v, v + 1 / b));
    if (
      (1 !== b ||
        !(
          s[0][1].sub(f).dot(l.sub(f)) < 0 || s[0][1].sub(h).dot(d.sub(h)) < 0
        )) &&
      _isApproximationClose(y, P, m, x, s, c)
    )
      break;
  }
  return toFlatArray(s);
}

function cubicToQuad(n, t, i, o, r, e, u, a, c) {
  var s = solveInflections(n, t, i, o, r, e, u, a);
  if (!s.length) return _cubicToQuad(n, t, i, o, r, e, u, a, c);
  for (
    var f, l, d = [], h = [n, t, i, o, r, e, u, a], p = 0, y = 0; y < s.length; y++
  )
    (f = _cubicToQuad(
      (l = subdivideCubic(
        h[0],
        h[1],
        h[2],
        h[3],
        h[4],
        h[5],
        h[6],
        h[7],
        1 - (1 - s[y]) / (1 - p)
      ))[0][0],
      l[0][1],
      l[0][2],
      l[0][3],
      l[0][4],
      l[0][5],
      l[0][6],
      l[0][7],
      c
    )),
    (d = d.concat(f.slice(0, -2))),
    (h = l[1]),
    (p = s[y]);
  return (
    (f = _cubicToQuad(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], c)),
    d.concat(f)
  );
}
(Point.prototype.add = function(n) {
  return new Point(this.x + n.x, this.y + n.y);
}),
(Point.prototype.sub = function(n) {
  return new Point(this.x - n.x, this.y - n.y);
}),
(Point.prototype.mul = function(n) {
  return new Point(this.x * n, this.y * n);
}),
(Point.prototype.div = function(n) {
  return new Point(this.x / n, this.y / n);
}),
(Point.prototype.sqr = function() {
  return this.x * this.x + this.y * this.y;
}),
(Point.prototype.dot = function(n) {
  return this.x * n.x + this.y * n.y;
});
