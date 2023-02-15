import * as turf from "@turf/turf";
import * as mathjs from "mathjs";

interface TracePoint {
	t: number;
	latitude: number;
	longitude: number;
	speed: number;
	direction: number;
	status?: 1 | 0;
}

interface DeltaLonLat {
	dLon: number; //经度随时间的变化速率
	dLat: number; //纬度随时间的变化速率
}

class TraceInterpolation {
	public start: TracePoint;
	public end: TracePoint;
	public lonFunc: Record<string, any>;
	public latFunc: Record<string, any>;
	public t0: number;
	constructor(start: TracePoint, end: TracePoint, t0: number) {
		this.start = { ...start };
		this.end = { ...end };
		this.t0 = t0;
		this.solveInterpolationFunction();
	}
	/**
	 * @description 数据预处理
	 * 计算经度变化率和纬度变化率
	 */
	private preProcess(point: TracePoint): DeltaLonLat {
		const speedx =
			point.speed * mathjs.sin((point.direction / 180) * mathjs.pi);
		const speedy =
			point.speed * mathjs.cos((point.direction / 180) * mathjs.pi);
		const xPoint = turf.destination(
			turf.point([point.longitude, point.latitude]),
			speedx,
			90,
			{ units: "meters" }
		);
		const yPoint = turf.destination(
			turf.point([point.longitude, point.latitude]),
			speedy,
			0,
			{ units: "meters" }
		);
		const dLon = (xPoint.geometry.coordinates[0] - point.longitude) / 1000;
		const dLat = (yPoint.geometry.coordinates[1] - point.latitude) / 1000;
		return {
			dLon,
			dLat,
		};
	}
	private solveInterpolationFunction(): void {
		const startDeltaLonLat = this.preProcess(this.start);
		const endDeltaLonLat = this.preProcess(this.end);
		const startT = this.start.t - this.t0;
		const endT = this.end.t - this.t0;
		// 经度函数
		const A = mathjs.matrix([
			[startT * startT * startT, startT * startT, startT, 1],
			[3 * startT * startT, 2 * startT, 1, 0],
			[endT * endT * endT, endT * endT, endT, 1],
			[3 * endT * endT, 2 * endT, 1, 0],
		]);
		const lonb = mathjs.matrix([
			this.start.longitude,
			startDeltaLonLat.dLon,
			this.end.longitude,
			endDeltaLonLat.dLon,
		]);
		const lonFunc_ = mathjs.multiply(mathjs.inv(A), lonb);
		this.lonFunc = {
			a: lonFunc_.subset(mathjs.index(0)),
			b: lonFunc_.subset(mathjs.index(1)),
			c: lonFunc_.subset(mathjs.index(2)),
			d: lonFunc_.subset(mathjs.index(3)),
		};
		// 纬度函数
		const latb = mathjs.matrix([
			this.start.latitude,
			startDeltaLonLat.dLat,
			this.end.latitude,
			endDeltaLonLat.dLat,
		]);
		const latFunc_ = mathjs.multiply(mathjs.inv(A), latb);
		this.latFunc = {
			a: latFunc_.subset(mathjs.index(0)),
			b: latFunc_.subset(mathjs.index(1)),
			c: latFunc_.subset(mathjs.index(2)),
			d: latFunc_.subset(mathjs.index(3)),
		};
		return;
	}
    public getCoordinate(t: number): Record<string, number> {
        t -= this.t0;
		const lon =
			this.lonFunc.a * t * t * t +
			this.lonFunc.b * t * t +
			this.lonFunc.c * t +
			this.lonFunc.d;
		const lat =
			this.latFunc.a * t * t * t +
			this.latFunc.b * t * t +
			this.latFunc.c * t +
			this.latFunc.d;
		return {
			longitude: lon,
			latitude: lat,
		};
	}
}

export default TraceInterpolation;
