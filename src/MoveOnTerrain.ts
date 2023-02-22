import * as Cesium from "cesium";
import * as turf from "@turf/turf";
import { linepPlaneIntersection, planeFit, getRotation } from "./utils";

class MoveOnTerrain {
	public terrainType: 0 | 1 = 0;
	public viewer: Cesium.Viewer;
	public moveingObj: Cesium.Entity | Cesium.Primitive;
	public excludeObjects: any[];

	/**
	 * @param terrainType 地形数据来源:terrainType=0,地形数据来自于倾斜模型走贴地;terrainType=1,地形数据来自于地形瓦片走地形采样逻辑
	 * @param viewer
	 * @param moveingObj
	 * @param excludeObjects 在采集地形数据时需要排除的对象,防止采集到错误的地形上如建筑物和植被
	 */
	constructor(
		terrainType: 0 | 1,
		viewer: Cesium.Viewer,
		moveingObj: Cesium.Entity | Cesium.Primitive,
		excludeObjects: any[]
	) {
		this.terrainType = terrainType;
		this.viewer = viewer;
		this.moveingObj = moveingObj;
		this.excludeObjects = excludeObjects;
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
	 * @description 基于当前轨迹点, 行驶方向和地形数据(来自于地形瓦片)计算姿态
	 * @param position 当前轨迹点
	 * @param heading 行驶方向
	 * @returns 姿态四元数
	 */
	public async sampleToTerrain(
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
        从当前轨迹点行进方向及其垂直方向1m处各采集2个点与该轨迹点拟合地形平面← · →
                                                                          ↓
        */
		const point0 = turf.point([longitude, latitude]);
		const bearing1: number = this.azimuthToBearing(heading);
		const point1 = turf.destination(point0, 1, bearing1, {
			units: "meters",
		});
		const poiPromise1 = this.viewer.scene.sampleHeightMostDetailed(
			[
				Cesium.Cartographic.fromDegrees(
					point1.geometry.coordinates[0],
					point1.geometry.coordinates[1]
				),
			],
			[...this.excludeObjects]
		);
		const bearing2 = this.azimuthToBearing((heading + 90) % 360);
		const point2 = turf.destination(point0, 1, bearing2, {
			units: "meters",
		});
		const poiPromise2 = this.viewer.scene.sampleHeightMostDetailed(
			[
				Cesium.Cartographic.fromDegrees(
					point2.geometry.coordinates[0],
					point2.geometry.coordinates[1]
				),
			],
			[...this.excludeObjects]
		);
		const bearing3 = this.azimuthToBearing((heading + 180) % 360);
		const point3 = turf.destination(point0, 1, bearing3, {
			units: "meters",
		});
		const poiPromise3 = this.viewer.scene.sampleHeightMostDetailed(
			[
				Cesium.Cartographic.fromDegrees(
					point3.geometry.coordinates[0],
					point3.geometry.coordinates[1]
				),
			],
			[...this.excludeObjects]
		);
		const bearing4 = this.azimuthToBearing((heading + 270) % 360);
		const point4 = turf.destination(point0, 1, bearing4, {
			units: "meters",
		});
		const poiPromise4 = this.viewer.scene.sampleHeightMostDetailed(
			[
				Cesium.Cartographic.fromDegrees(
					point4.geometry.coordinates[0],
					point4.geometry.coordinates[1]
				),
			],
			[...this.excludeObjects]
		);
		const resHPR = await Promise.all([
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
				positions.push(position);
				const positionsXYZ = positions.map((position) => {
					return [position.x, position.y, position.z];
				});
				const [a, b, c, d] = planeFit(positionsXYZ);
				//点沿椭球面法线方向投影至平面
				const pointProjectToPlane = (lon, lat, a, b, c, d) => {
					const pointS = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
					const pointE = Cesium.Cartesian3.fromDegrees(lon, lat, 10);
					const norm = Cesium.Cartesian3.normalize(
						Cesium.Cartesian3.subtract(
							pointE,
							pointS,
							new Cesium.Cartesian3()
						),
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
				};
				const point1PlaneXYZ = pointProjectToPlane(
					point1.geometry.coordinates[0],
					point1.geometry.coordinates[1],
					a,
					b,
					c,
					d
				);
				const point0PlaneXYZ = pointProjectToPlane(
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
					new Cesium.Cartesian3(
						a as number,
						b as number,
						c as number
					),
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
				const rotationMatrix =
					Cesium.Matrix3.fromArray(rotationMatrixValues);
				return Cesium.Quaternion.fromRotationMatrix(
					rotationMatrix,
					new Cesium.Quaternion()
				);
			})
			.catch((err) => {
				console.log(err);
				return new Cesium.Quaternion(0, 0, 0, 1);
			});
		return resHPR;
	}
}
