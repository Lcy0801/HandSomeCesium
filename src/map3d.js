import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import traceData from "./data/Trace_.json";
import * as turf from "@turf/turf";
import TraceInterpolation from "./interpolation";
import { planeFit, getRotation } from "./utils";
window.planeFit = planeFit;

class Map3D {
	initMap(container) {
		Cesium.Ion.defaultAccessToken = CesiumToken;
		this.viewer = new Cesium.Viewer(container, {
			timeline: false,
			animation: false,
			shouldAnimate: false,
			terrainProvider: new Cesium.CesiumTerrainProvider({
				url: Cesium.IonResource.fromAssetId(1),
			}),
		});
		this.viewer.camera.setView({
			destination: Cesium.Cartesian3.fromDegrees(
				traceData.features[0].geometry.coordinates[0],
				traceData.features[0].geometry.coordinates[1],
				100
			),
			orientation: Cesium.HeadingPitchRoll.fromDegrees(0, -45, 0),
		});
		this.zDataSource = new Cesium.CustomDataSource("zAxis");
		this.xDataSource = new Cesium.CustomDataSource("xAxis");
		// this.viewer.dataSources.add(this.zDataSource);
		window.viewer = this.viewer;
		window.Cesium = Cesium;
		window.map3d = this;
		//等待10s后开始绘制轨迹，确保轨迹区域的地形瓦片已经加载完成能够准确的采集地形高度
		this.otherSource = new Cesium.CustomDataSource("otherSource");
		this.viewer.dataSources.add(this.otherSource);
		setTimeout(() => {
			this.carMove();
		}, 10000);
	}
	carMove() {
		//准备车辆模型
		this.carEntity = this.viewer.entities.add({
			position: new Cesium.Cartesian3(0, 0, 0),
			orientation: new Cesium.Quaternion(0, 0, 0, 1),
			model: {
				uri: "car3.gltf",
			},
		});
		this.viewer.trackedEntity = this.carEntity;
		// traceData.features = traceData.features.slice(0, 30);
		const points = traceData.features;
		const tracePointDataSource = new Cesium.CustomDataSource("tracePoint");
		this.tracePointDataSource = tracePointDataSource;
		this.viewer.dataSources.add(tracePointDataSource);
		//绘制轨迹点
		points.forEach((point) => {
			const position = Cesium.Cartographic.fromDegrees(
				point.geometry.coordinates[0],
				point.geometry.coordinates[1]
			);
			this.viewer.scene
				.sampleHeightMostDetailed([position])
				.then((value) => {
					const position_ = Cesium.Cartographic.toCartesian(value[0]);
					tracePointDataSource.entities.add({
						position: position_,
						point: {
							color: Cesium.Color.RED,
							pixelSize: 5,
							heightReference:
								Cesium.HeightReference.CLAMP_TO_GROUND,
						},
					});
				});
		});
		//绘制轨迹线
		const traceLine = this.viewer.entities.add({
			polyline: {
				positions: points.map((point) => {
					return Cesium.Cartesian3.fromDegrees(
						point.geometry.coordinates[0],
						point.geometry.coordinates[1]
					);
				}),
				material: new Cesium.ColorMaterialProperty(Cesium.Color.ORANGE),
				clampToGround: true,
				width: 2,
			},
		});
		this.traceLine = traceLine;
		// 计算轨迹点的速度和方向
		const num = points.length;
		const points_ = [];
		for (let index = 0; index < num; index++) {
			const point = points[index];
			const lastPoint = index === 0 ? points[1] : points[index - 1];
			const dist = turf.distance(
				point.geometry.coordinates,
				lastPoint.geometry.coordinates,
				{ units: "meters" }
			);
			const dt =
				Math.abs(point.properties.t - lastPoint.properties.t) / 1000;
			const speed = dist / dt;
			const bearing = turf.bearing(
				lastPoint.geometry.coordinates,
				point.geometry.coordinates
			);
			const bearing_ = bearing < 0 ? bearing + 360 : bearing;
			const direction = index === 0 ? (bearing_ + 180) % 360 : bearing_;
			points_.push({
				t: point.properties.t,
				longitude: point.geometry.coordinates[0],
				latitude: point.geometry.coordinates[1],
				speed: speed,
				direction: direction,
			});
		}
		//轨迹的开始时间
		const t0 = points_[0].t;
		const traces = [];
		for (let index = 1; index < num; index++) {
			const startPoint = points_[index - 1];
			const endPoint = points_[index];
			const trace = new TraceInterpolation(startPoint, endPoint);
			traces.push(trace);
		}
		//根据插值时间计算对应插值轨迹段
		const getTraceByTime = (t) => {
			const index = points_.findIndex((point_) => {
				return point_.t > t;
			});
			return index === -1 ? undefined : traces[index - 1];
		};
		const interTracePointSource = new Cesium.CustomDataSource(
			"interTracePoint"
		);
		this.interTracePointSource = interTracePointSource;
		this.viewer.dataSources.add(interTracePointSource);
		this.viewer.clock.onTick.addEventListener((tick) => {
			const t = Cesium.JulianDate.toDate(tick.currentTime).getTime();
			const trace = getTraceByTime(t);
			if (!trace) {
				return;
			}
			const { latitude, longitude } = trace.getCoordinate(t);
			const diffT = 10;
			const { latitude: latitude_, longitude: longitude_ } =
				trace.getCoordinate(t - diffT);
			const bearing = turf.bearing(
				turf.point([longitude_, latitude_]),
				turf.point([longitude, latitude])
			);
			const heading = bearing < 0 ? bearing + 360 : bearing;
			const hpr = new Cesium.HeadingPitchRoll(
				Cesium.Math.toRadians(heading),
				0,
				0
			);
			const position = Cesium.Cartographic.fromDegrees(
				longitude,
				latitude
			);
			this.viewer.scene
				.sampleHeightMostDetailed(
					[position],
					[
						traceLine,
						...tracePointDataSource.entities.values,
						...interTracePointSource.entities.values,
						this.carEntity,
						...this.otherSource.entities.values,
						...this.zDataSource.entities.values,
						...this.xDataSource.entities.values,
					]
				)
				.then(async (value) => {
					const position_ = Cesium.Cartographic.toCartesian(value[0]);
					const qua = Cesium.Transforms.headingPitchRollQuaternion(
						position_,
						hpr,
						Cesium.Ellipsoid.WGS84,
						Cesium.Transforms.localFrameToFixedFrameGenerator(
							"north",
							"west"
						)
					);
					const qua_ = await this.clampToTerrain(position_, heading);
					console.log(qua_, "基于贴地算法计算的姿态");
					this.carEntity.position = position_;
					this.carEntity.orientation = qua_;
					interTracePointSource.entities.add({
						position: position_,
						point: {
							pixelSize: 3,
							color: Cesium.Color.YELLOW,
						},
					});
				});
		});
		//更改cesium系统时间为轨迹开始时间
		this.viewer.clock.shouldAnimate = true;
		this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(
			new Date(t0)
		);
	}
	async clampToTerrain(position, heading) {
		const headingToBearing = (heading) => {
			return heading <= 180 ? heading : heading - 360;
		};
		const position_ = Cesium.Cartographic.fromCartesian(position);
		const longitude = Cesium.Math.toDegrees(position_.longitude);
		const latitude = Cesium.Math.toDegrees(position_.latitude);
		const point0 = turf.point([longitude, latitude]);
		const bearing1 = headingToBearing(heading);
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
			[
				this.traceLine,
				...this.tracePointDataSource.entities.values,
				...this.interTracePointSource.entities.values,
				...this.otherSource.entities.values,
				this.carEntity,
				...this.zDataSource.entities.values,
				...this.xDataSource.entities.values,
			]
		);
		const bearing2 = headingToBearing((heading + 90) % 360);
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
			[
				this.traceLine,
				...this.tracePointDataSource.entities.values,
				...this.interTracePointSource.entities.values,
				...this.otherSource.entities.values,
				this.carEntity,
				...this.zDataSource.entities.values,
				...this.xDataSource.entities.values,
			]
		);
		const bearing3 = headingToBearing((heading + 180) % 360);
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
			[
				this.traceLine,
				...this.tracePointDataSource.entities.values,
				...this.interTracePointSource.entities.values,
				...this.otherSource.entities.values,
				this.carEntity,
				...this.zDataSource.entities.values,
				...this.xDataSource.entities.values,
			]
		);
		const bearing4 = headingToBearing((heading + 270) % 360);
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
			[
				this.traceLine,
				...this.tracePointDataSource.entities.values,
				...this.interTracePointSource.entities.values,
				...this.otherSource.entities.values,
				this.carEntity,
				...this.zDataSource.entities.values,
				...this.xDataSource.entities.values,
			]
		);
		const resHPR = await Promise.all([
			poiPromise1,
			poiPromise2,
			poiPromise3,
			poiPromise4,
		])
			.then((values) => {
				const positions = values.map((value) => {
					const poiOnTerrain = value[0];
					const poiOnTerrain_ =
						Cesium.Cartographic.toCartesian(poiOnTerrain);
					return poiOnTerrain_;
				});
				positions.push(position);
				positions.forEach((poi) => {
					this.otherSource.entities.add({
						position: poi,
						point: {
							pixelSize: 5,
							color: Cesium.Color.GREENYELLOW,
						},
					});
				});
				const positions_ = positions.map((position) => {
					return [position.x, position.y, position.z];
				});
				const [a, b, c, d] = planeFit(positions_);
				positions_.forEach((point) => {
					console.log(
						a * point[0] + b * point[1] + c * point[2] + d,
						"打印误差"
					);
				});
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
					return this.linepPlaneIntersection(
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
				const point1_ = pointProjectToPlane(
					point1.geometry.coordinates[0],
					point1.geometry.coordinates[1],
					a,
					b,
					c,
					d
				);
				const position_ = pointProjectToPlane(
					longitude,
					latitude,
					a,
					b,
					c,
					d
				);
				const vx = Cesium.Cartesian3.normalize(
					new Cesium.Cartesian3(
						point1_[0] - position_[0],
						point1_[1] - position_[1],
						point1_[2] - position_[2]
					),
					new Cesium.Cartesian3()
				);
				const vz = Cesium.Cartesian3.normalize(
					new Cesium.Cartesian3(a, b, c),
					new Cesium.Cartesian3()
				);
				const vy = Cesium.Cartesian3.normalize(
					Cesium.Cartesian3.cross(vz, vx, new Cesium.Cartesian3()),
					new Cesium.Cartesian3()
				);
				//绘制z轴:经检核z轴计算正确
				const zPoint = Cesium.Cartesian3.add(
					position,
					Cesium.Cartesian3.multiplyByScalar(
						vz,
						30,
						new Cesium.Cartesian3()
					),
					new Cesium.Cartesian3()
				);
				this.zDataSource.entities.add({
					polyline: {
						positions: [position, zPoint],
						material: new Cesium.PolylineArrowMaterialProperty(
							Cesium.Color.RED
						),
						width: 5,
					},
				});
				//绘制x轴
				const positionX = Cesium.Cartesian3.add(
					position,
					Cesium.Cartesian3.multiplyByScalar(
						vz,
						1,
						new Cesium.Cartesian3()
					),
					new Cesium.Cartesian3()
				);
				const xPoint = Cesium.Cartesian3.add(
					positionX,
					Cesium.Cartesian3.multiplyByScalar(
						vx,
						30,
						new Cesium.Cartesian3()
					),
					new Cesium.Cartesian3()
				);
				this.xDataSource.entities.add({
					polyline: {
						positions: [positionX, xPoint],
						material: new Cesium.PolylineArrowMaterialProperty(
							Cesium.Color.GREEN
						),
						width: 5,
					},
				});
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
				return undefined;
			});
		return resHPR;
	}
	//直线与平面的交点
	linepPlaneIntersection(x, y, z, n1, n2, n3, a, b, c, d) {
		const lamda = (a * x + b * y + c * z + d) / (n1 * a + n2 * b + n3 * c);
		const x_ = x - lamda * n1;
		const y_ = y - lamda * n2;
		const z_ = z - lamda * n3;
		return [x_, y_, z_];
	}
}
export default new Map3D();
