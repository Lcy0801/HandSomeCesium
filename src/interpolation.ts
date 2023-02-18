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
	public lonFunc: (t: number) => number;
	public latFunc: (t: number) => number;
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
		const lonFunc = mathjs.multiply(mathjs.inv(A), lonb);
		const lonFunc_ = {
			a: lonFunc.subset(mathjs.index(0)) as unknown as number,
			b: lonFunc.subset(mathjs.index(1)) as unknown as number,
			c: lonFunc.subset(mathjs.index(2)) as unknown as number,
			d: lonFunc.subset(mathjs.index(3)) as unknown as number,
		};
		this.lonFunc = (t: number): number => { 
			const dt = t - this.t0;
			return lonFunc_.a * dt * dt * dt + lonFunc_.b * dt * dt + lonFunc_.c * dt + lonFunc_.d;
		}
		// 纬度函数
		const latb = mathjs.matrix([
			this.start.latitude,
			startDeltaLonLat.dLat,
			this.end.latitude,
			endDeltaLonLat.dLat,
		]);
		const latFunc = mathjs.multiply(mathjs.inv(A), latb);
		const latFunc_ = {
			a:latFunc.subset(mathjs.index(0)) as unknown as number,
			b:latFunc.subset(mathjs.index(1)) as unknown as number,
			c:latFunc.subset(mathjs.index(2)) as unknown as number,
			d:latFunc.subset(mathjs.index(3)) as unknown as number,
		};
		this.latFunc = (t: number):number => { 
			const dt = t - this.t0;
			return (
				latFunc_.a * dt * dt * dt +
				latFunc_.b * dt * dt +
				latFunc_.c * dt +
				latFunc_.d
			)
		}
		return;
	}
    public getCoordinate(t: number): Record<string, number> {
		const lon = this.lonFunc(t);
		const lat = this.latFunc(t);
		return {
			longitude: lon,
			latitude: lat,
		};
	}
}

export default TraceInterpolation;
