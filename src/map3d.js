import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import traceData from "./data/Trace_.json";
import * as turf from "@turf/turf";
import TraceInterpolation from "./interpolation";
import { planeFit, getRotation } from "./utils";

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
		window.viewer = this.viewer;
		window.Cesium = Cesium;
		//等待10s后开始绘制轨迹，确保轨迹区域的地形瓦片已经加载完成能够准确的采集地形高度
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
					]
				)
				.then((value) => {
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
					this.carEntity.position = position_;
					this.carEntity.orientation = qua;
					const entity = interTracePointSource.entities.add({
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
				traceLine,
				...this.tracePointDataSource.entities.values,
				...this.interTracePointSource.entities.values,
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
				traceLine,
				...this.tracePointDataSource.entities.values,
				...this.interTracePointSource.entities.values,
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
				traceLine,
				...this.tracePointDataSource.entities.values,
				...this.interTracePointSource.entities.values,
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
				traceLine,
				...this.tracePointDataSource.entities.values,
				...this.interTracePointSource.entities.values,
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
				const positions_ = positions.map((position) => {
					return [position.x, position.y, position.z];
				});
				const [a, b, c] = planeFit(positions_);
				// 计算点在面上的投影点的坐标
				const pointProjectToPlane = (x, y, z, a, b, c, d) => {
					const dist =
						(a * x + b * y + c * z + d) / (a * a + b * b + c * c);
					return [x - dist * a, y - dist * b, z - dist * c, dist];
				};
				// 将heading方位的点投影至平面
				const point1_ = Cesium.Cartographic.toCartesian(values[0][0]);
				const [x1, y1, z1,dist1] = pointProjectToPlane(
					point1_.x,
					point1_.y,
					point1_.z,
					a,
					b,
					c,
					1
				);
				const v1 = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(point1_, new Cesium.Cartesian3(x1, y1, z1), new Cesium.Cartesian3()), new Cesium.Cartesian3());
				const v2 = Cesium.Cartesian3.normalize(point1_, new Cesium.Cartesian3());
				const dist = Math.abs(dist1 / Cesium.Cartesian3.dot(v1, v2));
				const point1__ = Cesium.Cartesian3.subtract(point1_, dist * v2, new Cesium.Cartesian3());
				const vx = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(point1__, position, new Cesium.Cartesian3()),new Cesium.Cartesian3());
				const vz = Cesium.Cartesian3.normalize(new Cesium.Cartesian3(a, b, c), new Cesium.Cartesian3());
				const vy = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(vz, vx, new Cesium.Cartesian3()), new Cesium.Cartesian3());
				
			})
			.catch(() => {
				return undefined;
			});
		return resHPR;
	}
}
export default new Map3D();
