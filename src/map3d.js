import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import traceData from "./data/Trace_.json";
import * as turf from "@turf/turf";
import TraceInterpolation from "./interpolation";
import MoveOnTerrain from "./MoveOnTerrain";

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
		window.map3d = this;
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
		const traces = [];
		for (let index = 1; index < num; index++) {
			const startPoint = points_[index - 1];
			const endPoint = points_[index];
			const trace = new TraceInterpolation(startPoint, endPoint);
			traces.push(trace);
		}
		const carMoveOnTerrain = new MoveOnTerrain(
            1,
			this.viewer,
			this.carEntity,
			[
                this.carEntity,
				this.traceLine,
				...this.tracePointDataSource.entities.values,			],
			true
            );
            //根据插值时间计算对应插值轨迹段
            const getTraceByTime = (t) => {
                const index = points_.findIndex((point_) => {
                    return point_.t > t;
                });
                return index === -1 ? undefined : traces[index - 1];
            };
            this.viewer.clock.onTick.addEventListener(async (tick) => {
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
			carMoveOnTerrain.setOrientationAndPostion(
				longitude,
				latitude,
				heading
			);
		});
		//轨迹的开始时间
		const t0 = points_[0].t;
		//更改cesium系统时间为轨迹开始时间
		this.viewer.clock.shouldAnimate = true;
		//在开始cesium的动画后，cesium的当前时间会自动设置为当前系统时间，因此此时需要重新设置cesium的当前时间
		this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(
			new Date(t0)
		);
	}
}
export default new Map3D();
