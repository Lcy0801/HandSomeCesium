import * as Cesium from "cesium";
import * as turf from "@turf/turf";
import { linepPlaneIntersection, planeFit, getRotation } from "./utils";

class MoveOnTerrain {
	public terrainType: 0 | 1 = 0;
	public viewer: Cesium.Viewer;
	public moveingObj: Cesium.Entity | Cesium.Primitive;
	public excludeObjects: any[];
	public isAsync: boolean;

	/**
	 * @param terrainType 地形数据来源:terrainType=0,地形数据来自于倾斜模型走贴地;terrainType=1,地形数据来自于地形瓦片走地形采样逻辑
	 * @param viewer
	 * @param moveingObj
	 * @param excludeObjects 在采集地形数据时需要排除的对象,防止采集到错误的地形上如建筑物和植被
	 * @param isAsync 是否异步获取地形数据 异步获取京都更高但性能开销大 默认不采用异步获取地形的方式
	 */
	constructor(
		terrainType: 0 | 1,
		viewer: Cesium.Viewer,
		moveingObj: Cesium.Entity | Cesium.Primitive,
		excludeObjects: any[],
		isAsync: false
	) {
		this.terrainType = terrainType;
		this.viewer = viewer;
		this.moveingObj = moveingObj;
		this.excludeObjects = excludeObjects;
		this.isAsync = isAsync;
	}

	/**
	 * @description 方位角转换
	 * @param azimuth 方位角正北方向为0, 顺时针旋转0->360
	 * @returns bearing 正北方向为0, 顺时针旋转为正0->180, 逆时针旋转为负0->-180, turf方位角的计算遵循该规则
	 */
	protected azimuthToBearing(azimuth: number): number {
		return azimuth <= 180 ? azimuth : azimuth - 360;
	}

	/**
	 * @description 点沿椭球面法线方向投影至平面
	 * @param lon 经度
	 * @param lat 纬度
	 * @param a b c d 平面方程
	 * @returns
	 */
	protected pointProjectToPlane(lon, lat, a, b, c, d) {
		const pointS = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
		const pointE = Cesium.Cartesian3.fromDegrees(lon, lat, 10);
		const norm = Cesium.Cartesian3.normalize(
			Cesium.Cartesian3.subtract(pointE, pointS, new Cesium.Cartesian3()),
			new Cesium.Cartesian3()
		);
		return linepPlaneIntersection(
			pointS.x,
			pointS.y,
			pointS.z,
			norm.x,
			norm.y,
			norm.z,
			a,
			b,
			c,
			d
		);
	}

	/**
	 * @description 基于当前轨迹点, 行驶方向和地形数据(来自于地形瓦片)计算姿态
	 * @param position 当前轨迹点
	 * @param heading 行驶方向
	 * @returns 姿态四元数
	 */
	protected async sampleToTerrain(
		position: Cesium.Cartesian3,
		heading: number
	): Promise<Cesium.Quaternion> {
		if (!this.viewer.scene.sampleHeightSupported) {
			return new Cesium.Quaternion(0, 0, 0, 1);
		}
		const position_ = Cesium.Cartographic.fromCartesian(position);
		const longitude = Cesium.Math.toDegrees(position_.longitude);
		const latitude = Cesium.Math.toDegrees(position_.latitude);
		/*
                                                                          ↑
        从当前轨迹点行进方向及其垂直方向1m处各采集2个点与该轨迹点拟合地形平面      ← · →
                                                                          ↓
        */
		const point0__ = turf.point([longitude, latitude]);
		const bearing1: number = this.azimuthToBearing(heading);
		const point1__ = turf.destination(point0__, 1, bearing1, {
			units: "meters",
		});
		const bearing2 = this.azimuthToBearing((heading + 90) % 360);
		const point2__ = turf.destination(point0__, 1, bearing2, {
			units: "meters",
		});
		const bearing3 = this.azimuthToBearing((heading + 180) % 360);
		const point3__ = turf.destination(point0__, 1, bearing3, {
			units: "meters",
		});
		const bearing4 = this.azimuthToBearing((heading + 270) % 360);
		const point4__ = turf.destination(point0__, 1, bearing4, {
			units: "meters",
		});
		let positions: Cesium.Cartesian3[] | undefined;
		if (this.isAsync) {
			//异步获取地形数据
			const poiPromise0 = this.viewer.scene.sampleHeightMostDetailed(
				[
					Cesium.Cartographic.fromDegrees(
						point0__.geometry.coordinates[0],
						point0__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			const poiPromise1 = this.viewer.scene.sampleHeightMostDetailed(
				[
					Cesium.Cartographic.fromDegrees(
						point1__.geometry.coordinates[0],
						point1__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			const poiPromise2 = this.viewer.scene.sampleHeightMostDetailed(
				[
					Cesium.Cartographic.fromDegrees(
						point2__.geometry.coordinates[0],
						point2__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			const poiPromise3 = this.viewer.scene.sampleHeightMostDetailed(
				[
					Cesium.Cartographic.fromDegrees(
						point3__.geometry.coordinates[0],
						point3__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			const poiPromise4 = this.viewer.scene.sampleHeightMostDetailed(
				[
					Cesium.Cartographic.fromDegrees(
						point4__.geometry.coordinates[0],
						point4__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			positions = await Promise.all([
				poiPromise0,
				poiPromise1,
				poiPromise2,
				poiPromise3,
				poiPromise4,
			])
				.then((values) => {
					const positions = values.map((value) => {
						const poiOnTerrain_ = value[0];
						const poiOnTerrain =
							Cesium.Cartographic.toCartesian(poiOnTerrain_);
						return poiOnTerrain;
					});
					return positions;
				})
				.catch((error) => {
					console.log(`异步获取地形数据错误:${error}`);
					return undefined;
				});
		} else {
			// 同步获取地形数据
			const height0 = this.viewer.scene.sampleHeight(
				Cesium.Cartographic.fromDegrees(
					point0__.geometry.coordinates[0],
					point0__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point0 = Cesium.Cartesian3.fromDegrees(
				point0__.geometry.coordinates[0],
				point0__.geometry.coordinates[1],
				height0
			);
			const height1 = this.viewer.scene.sampleHeight(
				Cesium.Cartographic.fromDegrees(
					point1__.geometry.coordinates[0],
					point1__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point1 = Cesium.Cartesian3.fromDegrees(
				point1__.geometry.coordinates[0],
				point1__.geometry.coordinates[1],
				height1
			);
			const height2 = this.viewer.scene.sampleHeight(
				Cesium.Cartographic.fromDegrees(
					point2__.geometry.coordinates[0],
					point2__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point2 = Cesium.Cartesian3.fromDegrees(
				point2__.geometry.coordinates[0],
				point2__.geometry.coordinates[1],
				height2
			);
			const height3 = this.viewer.scene.sampleHeight(
				Cesium.Cartographic.fromDegrees(
					point3__.geometry.coordinates[0],
					point3__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point3 = Cesium.Cartesian3.fromDegrees(
				point3__.geometry.coordinates[0],
				point3__.geometry.coordinates[1],
				height3
			);
			const height4 = this.viewer.scene.sampleHeight(
				Cesium.Cartographic.fromDegrees(
					point4__.geometry.coordinates[0],
					point4__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point4 = Cesium.Cartesian3.fromDegrees(
				point4__.geometry.coordinates[0],
				point4__.geometry.coordinates[1],
				height4
			);
			positions = [point0, point1, point2, point3, point4];
		}
		if (positions === undefined) {
			return new Cesium.Quaternion(0, 0, 0, 1);
		}
		const positionsXYZ = positions.map((position) => {
			return [position.x, position.y, position.z];
		});
		const [a, b, c, d] = planeFit(positionsXYZ);
		//点沿椭球面法线方向投影至平面
		const point1PlaneXYZ = this.pointProjectToPlane(
			point1__.geometry.coordinates[0],
			point1__.geometry.coordinates[1],
			a,
			b,
			c,
			d
		);
		const point0PlaneXYZ = this.pointProjectToPlane(
			longitude,
			latitude,
			a,
			b,
			c,
			d
		);
		const vx = Cesium.Cartesian3.normalize(
			new Cesium.Cartesian3(
				point1PlaneXYZ[0] - point0PlaneXYZ[0],
				point1PlaneXYZ[1] - point0PlaneXYZ[1],
				point1PlaneXYZ[2] - point0PlaneXYZ[2]
			),
			new Cesium.Cartesian3()
		);
		const vz = Cesium.Cartesian3.normalize(
			new Cesium.Cartesian3(a as number, b as number, c as number),
			new Cesium.Cartesian3()
		);
		const vy = Cesium.Cartesian3.normalize(
			Cesium.Cartesian3.cross(vz, vx, new Cesium.Cartesian3()),
			new Cesium.Cartesian3()
		);
		const rotationMatrixValues = getRotation(
			[vx.x, vx.y, vx.z],
			[vy.x, vy.y, vy.z],
			[vz.x, vz.y, vz.z],
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1]
		);
		const rotationMatrix = Cesium.Matrix3.fromArray(rotationMatrixValues);
		return Cesium.Quaternion.fromRotationMatrix(
			rotationMatrix,
			new Cesium.Quaternion()
		);
	}

	/**
	 * @description 基于当前轨迹点, 行驶方向和地形数据(来自于倾斜模型)计算姿态
	 * @param position 当前轨迹点
	 * @param heading 行驶方向
	 * @returns 姿态四元数
	 */
	protected async clampToTerrain(
		position: Cesium.Cartesian3,
		heading: number
	): Promise<Cesium.Quaternion> {
		if (!this.viewer.scene.clampToHeightSupported) {
			return new Cesium.Quaternion(0, 0, 0, 1);
		}
		const position_ = Cesium.Cartographic.fromCartesian(position);
		const longitude = Cesium.Math.toDegrees(position_.longitude);
		const latitude = Cesium.Math.toDegrees(position_.latitude);
		/*
                                                                          ↑
        从当前轨迹点行进方向及其垂直方向1m处各采集2个点与该轨迹点拟合地形平面      ← · →
                                                                          ↓
        */
		const point0__ = turf.point([longitude, latitude]);
		const bearing1: number = this.azimuthToBearing(heading);
		const point1__ = turf.destination(point0__, 1, bearing1, {
			units: "meters",
		});
		const bearing2 = this.azimuthToBearing((heading + 90) % 360);
		const point2__ = turf.destination(point0__, 1, bearing2, {
			units: "meters",
		});
		const bearing3 = this.azimuthToBearing((heading + 180) % 360);
		const point3__ = turf.destination(point0__, 1, bearing3, {
			units: "meters",
		});
		const bearing4 = this.azimuthToBearing((heading + 270) % 360);
		const point4__ = turf.destination(point0__, 1, bearing4, {
			units: "meters",
		});
		let positions: Cesium.Cartesian3[] | undefined;
		if (this.isAsync) {
			//异步获取地形数据
			const poiPromise0 = this.viewer.scene.clampToHeightMostDetailed(
				[
					Cesium.Cartesian3.fromDegrees(
						point0__.geometry.coordinates[0],
						point0__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			const poiPromise1 = this.viewer.scene.clampToHeightMostDetailed(
				[
					Cesium.Cartesian3.fromDegrees(
						point1__.geometry.coordinates[0],
						point1__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			const poiPromise2 = this.viewer.scene.clampToHeightMostDetailed(
				[
					Cesium.Cartesian3.fromDegrees(
						point2__.geometry.coordinates[0],
						point2__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			const poiPromise3 = this.viewer.scene.clampToHeightMostDetailed(
				[
					Cesium.Cartesian3.fromDegrees(
						point3__.geometry.coordinates[0],
						point3__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			const poiPromise4 = this.viewer.scene.clampToHeightMostDetailed(
				[
					Cesium.Cartesian3.fromDegrees(
						point4__.geometry.coordinates[0],
						point4__.geometry.coordinates[1]
					),
				],
				[...this.excludeObjects]
			);
			positions = await Promise.all([
				poiPromise0,
				poiPromise1,
				poiPromise2,
				poiPromise3,
				poiPromise4,
			])
				.then((values) => {
					const positions = values.map((value) => {
						const poiOnTerrain = value[0];
						return poiOnTerrain;
					});
					return positions;
				})
				.catch((error) => {
					console.log(`异步获取地形数据错误:${error}`);
					return undefined;
				});
		} else {
			// 同步获取地形数据
			const point0 = this.viewer.scene.clampToHeight(
				Cesium.Cartesian3.fromDegrees(
					point0__.geometry.coordinates[0],
					point0__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point1 = this.viewer.scene.clampToHeight(
				Cesium.Cartesian3.fromDegrees(
					point1__.geometry.coordinates[0],
					point1__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point2 = this.viewer.scene.clampToHeight(
				Cesium.Cartesian3.fromDegrees(
					point2__.geometry.coordinates[0],
					point2__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point3 = this.viewer.scene.clampToHeight(
				Cesium.Cartesian3.fromDegrees(
					point3__.geometry.coordinates[0],
					point3__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			const point4 = this.viewer.scene.clampToHeight(
				Cesium.Cartesian3.fromDegrees(
					point4__.geometry.coordinates[0],
					point4__.geometry.coordinates[1]
				),
				[...this.excludeObjects]
			);
			positions = [point0, point1, point2, point3, point4];
		}
		if (positions === undefined) {
			return new Cesium.Quaternion(0, 0, 0, 1);
		}
		const positionsXYZ = positions.map((position) => {
			return [position.x, position.y, position.z];
		});
		const [a, b, c, d] = planeFit(positionsXYZ);
		//点沿椭球面法线方向投影至平面
		const point1PlaneXYZ = this.pointProjectToPlane(
			point1__.geometry.coordinates[0],
			point1__.geometry.coordinates[1],
			a,
			b,
			c,
			d
		);
		const point0PlaneXYZ = this.pointProjectToPlane(
			longitude,
			latitude,
			a,
			b,
			c,
			d
		);
		const vx = Cesium.Cartesian3.normalize(
			new Cesium.Cartesian3(
				point1PlaneXYZ[0] - point0PlaneXYZ[0],
				point1PlaneXYZ[1] - point0PlaneXYZ[1],
				point1PlaneXYZ[2] - point0PlaneXYZ[2]
			),
			new Cesium.Cartesian3()
		);
		const vz = Cesium.Cartesian3.normalize(
			new Cesium.Cartesian3(a as number, b as number, c as number),
			new Cesium.Cartesian3()
		);
		const vy = Cesium.Cartesian3.normalize(
			Cesium.Cartesian3.cross(vz, vx, new Cesium.Cartesian3()),
			new Cesium.Cartesian3()
		);
		const rotationMatrixValues = getRotation(
			[vx.x, vx.y, vx.z],
			[vy.x, vy.y, vy.z],
			[vz.x, vz.y, vz.z],
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1]
		);
		const rotationMatrix = Cesium.Matrix3.fromArray(rotationMatrixValues);
		return Cesium.Quaternion.fromRotationMatrix(
			rotationMatrix,
			new Cesium.Quaternion()
		);
	}

	/**
	 * @description 基于当前轨迹点, 行驶方向和地形数据计算姿态
	 * @param position 当前轨迹点
	 * @param heading 行驶方向
	 * @returns 姿态四元数
	 */
	public async getQuaternionByTerrain(position, heading) {
		const qua:Cesium.Quaternion =  this.terrainType === 0 ? await this.clampToTerrain(position, heading) : await this.sampleToTerrain(position, heading);
		return qua;
	}
}
