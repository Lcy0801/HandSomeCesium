import * as math from "mathjs"
/**
 * 平面方程拟合
 * @param {*} points 
 */
export const planeFit = (points) => { 
    const B = math.matrix(points);
    const L = math.multiply(math.ones(points.length), -1);
    const N = math.multiply(math.transpose(B), B);
    const U = math.multiply(math.transpose(B), L);
    const res = math.multiply(math.inv(N), U);
    const a = res.subset(math.index(0));
    const b = res.subset(math.index(1));
    const c = res.subset(math.index(2));
    return [a,b,c];
}
