import * as math from "mathjs"
window.math = math;
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

/**
 * 计算两个坐标系间的旋转欧拉角 按照zxz的顺序进行旋转
 * @param {*} xNormal x轴的单位向量
 * @param {*} yNormal y轴的单位向量
 * @param {*} zNormal z轴的单位向量
 */
export const getRotation = (
    xNormal1,
    yNormal1,
    zNormal1,
    xNormal2,
    yNormal2,
    zNormal2
) => {
    // 计算x1_o_y1与x2_o_y2平面的交线
    //改交线即垂直于z1轴也垂直于z2轴
    xNormal1 = math.matrix(xNormal1);
    yNormal1 = math.matrix(yNormal1);
    zNormal1 = math.matrix(zNormal1);
    xNormal2 = math.matrix(xNormal2);
    yNormal2 = math.matrix(yNormal2);
    zNormal2 = math.matrix(zNormal2);
    //计算第一次旋转的角度
    let x1_ = math.cross(zNormal1, zNormal2);   
    //单位化
    x1_ = math.divide(x1_, math.norm(x1_));
    let flag;
    flag = math.dot(x1_, xNormal2);
    if (flag < 0) { 
        // 交线方向应当与x2的方向相同
        x1_ = math.multiply(-1, x1_);
    }
    //计算交线与x1的夹角
    let rAngle1 = math.acos(math.dot(x1_, xNormal1) / (math.norm(x1_) * math.norm(xNormal1)));
    // 判断交线在x1的左侧还是右侧决定旋转的方向
    //flag>0：交线在右侧；flag<0：交线在左侧
    flag = math.dot(math.cross(x1_, xNormal1), zNormal1);
    if (flag < 0) { 
        // 逆时针旋转角度为正，顺时针旋转角度为负
        rAngle1 *= -1;
    }
    //计算第二次旋转的角度
    let rAngle2 = math.acos(math.dot(zNormal1, zNormal2) / (math.norm(zNormal1) * math.norm(zNormal2)));
    flag = math.dot(math.cross(zNormal1, zNormal2), x1_);
    // 判断旋转方向
    if (flag > 0) {
        rAngle2 *= -1;
    }
    //计算第三次旋转的角度
    let y1_ = math.cross(zNormal2, x1_);
    //单位化
    y1_ = math.divide(y1_, math.norm(y1_));
    let rAngle3 = math.acos(math.dot(y1_, yNormal2) / (math.norm(y1_) * math.norm(yNormal2)));
    //判断旋转方向
    flag = math.dot(math.cross(y1_, yNormal2), zNormal2);
    if (flag < 0) { 
        rAngle3 *= -1;
    }
    //第一次旋转矩阵
    const R1 = Rodrigues(math.divide(zNormal1, math.norm(zNormal1)), rAngle1);
    //第二次旋转矩阵
    const R2 = Rodrigues(x1_,rAngle2);
    //第三次旋转矩阵
    const R3 = Rodrigues(math.divide(zNormal2, math.norm(zNormal2)), rAngle3);
    const R = math.multiply(R3, math.multiply(R2, R1));
    const Rvalues = math.flatten(R)._data;
    return Rvalues;
};

// 罗德里格旋转公式
const Rodrigues = (axis, angle) => { 
    axis = math.divide(axis, math.norm(axis));
    const Rk = math.matrix([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]]);
    const I = math.matrix(math.diag([1, 1, 1]));
    const M1 = I;
    const M2 = math.multiply(1 - math.cos(angle), math.multiply(Rk, Rk));
    const M3 = math.multiply(Rk, math.sin(angle));
    const M = math.add(M1, math.add(M2, M3));
    return M;
}