import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import { planeFit } from "./utils";
import * as turf from "@turf/turf";
import { getRotation } from "./utils";
window.turf = turf;

class Map3D {
    initMap(container) {
        Cesium.Ion.defaultAccessToken = CesiumToken;
        this.viewer = new Cesium.Viewer(container, {
            geocoder: false, // 隐藏搜索
            homeButton: false, // 隐藏主页
            sceneModePicker: false, // 隐藏二三维转换
            baseLayerPicker: false, // 隐藏图层选择控件
            navigationHelpButton: false, // 隐藏帮助按钮
            animation: false, // 隐藏时钟
            timeline: false, // 隐藏时间轴
            fullscreenButton: true, // 隐藏全屏
            vrButton: false, // 隐藏双屏模式
            infoBox: false, // 隐藏点击 entity 信息框
            selectionIndicator: false, // 隐藏点击 entity 绿框
            shouldAnimate: true,
            terrainProvider: new Cesium.CesiumTerrainProvider({
                url: Cesium.IonResource.fromAssetId(1),
            }),
        });
        // 存储绘制的地图瓦片的四至范围
        // this.tilesBoundingSource = new Cesium.CustomDataSource("tilesBounding");
        // this.viewer.dataSources.add(this.tilesBoundingSource);
        // this.showAxis();
        this.planeFit();
        window.map3d = this;
        //当视窗移动时打印新的视窗需要加载的瓦片范围
        // this.viewer.camera.changed.addEventListener(
        //   this.showLoadingTiles,
        //   this
        // );
    }
    //绘制笛卡尔坐标系的三个轴
    showAxis() {
        //地球的平均半径是6378137m
        const radius = 6500000;
        const axisDataSource = new Cesium.CustomDataSource("axis");
        this.viewer.dataSources.add(axisDataSource);
        axisDataSource.entities.add({
            id: "xAxis",
            position: new Cesium.Cartesian3(radius, 0, 0),
            label: {
                text: "x",
            },
            polyline: {
                positions: [
                    new Cesium.Cartesian3(1, 0, 0),
                    new Cesium.Cartesian3(radius, 0, 0),
                ],
                width: 10,
                material: new Cesium.PolylineArrowMaterialProperty(
                    Cesium.Color.RED
                ),
            },
        });
        axisDataSource.entities.add({
            id: "yAxis",
            position: new Cesium.Cartesian3(0, radius, 0),
            label: {
                text: "y",
            },
            polyline: {
                positions: [
                    new Cesium.Cartesian3(0, 1, 0),
                    new Cesium.Cartesian3(0, radius, 0),
                ],
                width: 10,
                material: new Cesium.PolylineArrowMaterialProperty(
                    Cesium.Color.GREEN
                ),
            },
        });
        axisDataSource.entities.add({
            id: "zAxis",
            position: new Cesium.Cartesian3(0, 0, radius),
            label: {
                text: "z",
            },
            polyline: {
                positions: [
                    new Cesium.Cartesian3(0, 0, 1),
                    new Cesium.Cartesian3(0, 0, radius),
                ],
                width: 10,
                material: new Cesium.PolylineArrowMaterialProperty(
                    Cesium.Color.BLUE
                ),
            },
        });
    }
    planeFit() {
        // 平面拟合demo
        const viewer = this.viewer;
        const pickDataSource = new Cesium.CustomDataSource("pickPoint");
        viewer.dataSources.add(pickDataSource);
        this.viewer.screenSpaceEventHandler.setInputAction(
            (event) => {
                viewer.entities.removeById("fitPlane");
                viewer.entities.removeById("xnormal");
                viewer.entities.removeById("znormal");
                viewer.entities.removeById("ynormal");
                document.getElementById("container").style.cursor = "crosshair";
                const ray = viewer.camera.getPickRay(event.position);
                const position = viewer.scene.globe.pick(ray, viewer.scene);
                pickDataSource.entities.add({
                    position: position,
                    point: {
                        color: Cesium.Color.RED,
                        pixelSize: 3,
                    },
                });
            },
            Cesium.ScreenSpaceEventType.LEFT_CLICK,
            Cesium.KeyboardEventModifier.CTRL
        );
        this.viewer.screenSpaceEventHandler.setInputAction(
            async (event) => {
                document.getElementById("container").style.cursor = "default";
                let points = [];
                pickDataSource.entities.values.forEach((entity) => {
                    points.push([
                        entity.position._value.x,
                        entity.position._value.y,
                        entity.position._value.z,
                    ]);
                });
                const [a, b, c] = planeFit(points);
                pickDataSource.entities.removeAll();
                const points_ = points.map((point) => {
                    let [x, y, z] = point;
                    z = -(a * x + b * y + 1) / c;
                    return new Cesium.Cartesian3(x, y, z);
                });
                viewer.entities.add({
                    id: "fitPlane",
                    polygon: {
                        hierarchy: {
                            positions: points_,
                        },
                        material: new Cesium.ColorMaterialProperty(
                            Cesium.Color.YELLOW
                        ),
                    },
                });
                //绘制法线
                let normal = Cesium.Cartesian3.normalize(
                    new Cesium.Cartesian3(a, b, c),
                    new Cesium.Cartesian3()
                );
                const flag = Cesium.Cartesian3.dot(
                    new Cesium.Cartesian3(a, b, c),
                    new Cesium.Cartesian3(0, 0, 1)
                );
                if (flag < 0) {
                    normal = Cesium.Cartesian3.normalize(
                        new Cesium.Cartesian3(-a, -b, -c),
                        new Cesium.Cartesian3()
                    );
                }
                let center = points_.reduce((preV, curV) => {
                    return Cesium.Cartesian3.add(
                        preV,
                        curV,
                        new Cesium.Cartesian3()
                    );
                }, new Cesium.Cartesian3());
                center = Cesium.Cartesian3.divideByScalar(
                    center,
                    points_.length,
                    new Cesium.Cartesian3()
                );
                let target = Cesium.Ray.getPoint(
                    new Cesium.Ray(center, normal),
                    100,
                    new Cesium.Cartesian3()
                );
                const normalEntity = viewer.entities.add({
                    id: "znormal",
                    polyline: {
                        positions: [center, target],
                        material: new Cesium.PolylineArrowMaterialProperty(
                            Cesium.Color.BLUE
                        ),
                        width: 6,
                    },
                });
                //基于输入的direction获取另外两个方向
                let direction = parseFloat(prompt("请输入行车方向："));
                if (direction > 180) {
                    direction -= 360;
                }
                const center_ = [
                    Cesium.Math.toDegrees(
                        Cesium.Cartographic.fromCartesian(center).longitude
                    ),
                    Cesium.Math.toDegrees(
                        Cesium.Cartographic.fromCartesian(center).latitude
                    ),
                ];
                let xPoint = turf.rhumbDestination(
                    turf.point(center_),
                    100,
                    direction,
                    { units: "meters" }
                );
                xPoint = (
                    await Cesium.sampleTerrainMostDetailed(
                        this.viewer.terrainProvider,
                        [
                            Cesium.Cartographic.fromDegrees(
                                xPoint.geometry.coordinates[0],
                                xPoint.geometry.coordinates[1]
                            ),
                        ]
                    )
                )[0];
                xPoint = Cesium.Cartesian3.fromRadians(
                    xPoint.longitude,
                    xPoint.latitude,
                    xPoint.height
                );
                xPoint = new Cesium.Cartesian3(
                    xPoint.x,
                    xPoint.y,
                    -(a * xPoint.x + b * xPoint.y + 1) / c
                );
                const xNormal = Cesium.Cartesian3.normalize(
                    Cesium.Cartesian3.subtract(
                        xPoint,
                        center,
                        new Cesium.Cartesian3()
                    ),
                    new Cesium.Cartesian3()
                );
                xPoint = Cesium.Ray.getPoint(
                    new Cesium.Ray(center, xNormal),
                    100,
                    new Cesium.Cartesian3()
                );
                viewer.entities.add({
                    id: "xnormal",
                    polyline: {
                        positions: [center, xPoint],
                        material: new Cesium.PolylineArrowMaterialProperty(
                            Cesium.Color.RED
                        ),
                        width: 6,
                    },
                });
                //绘制y轴
                const yNormal = Cesium.Cartesian3.normalize(
                    Cesium.Cartesian3.cross(
                        normal,
                        xNormal,
                        new Cesium.Cartesian3()
                    ),
                    new Cesium.Cartesian3()
                );
                let yPoint = Cesium.Ray.getPoint(
                    new Cesium.Ray(center, yNormal),
                    100,
                    new Cesium.Cartesian3()
                );
                viewer.entities.add({
                    id: "ynormal",
                    polyline: {
                        positions: [center, yPoint],
                        material: new Cesium.PolylineArrowMaterialProperty(
                            Cesium.Color.GREEN
                        ),
                        width: 6,
                    },
                });
                viewer.zoomTo(normalEntity);
                //计算坐标系间的转换参数
                //地形坐标系
                const xNormal1 = [xNormal.x, xNormal.y, xNormal.z];
                const yNormal1 = [yNormal.x, yNormal.y, yNormal.z];
                const zNormal1 = [normal.x, normal.y, normal.z];
                //北西天坐标系
                debugger;
                const modelMatrix = Cesium.Matrix4.inverse(
                    Cesium.Transforms.northWestUpToFixedFrame(center),
                    new Cesium.Matrix4()
                );
                const xNormal2 = Cesium.Matrix4.multiplyByVector(
                    modelMatrix,
                    new Cesium.Cartesian4(1, 0, 0, 1),
                    new Cesium.Cartesian4()
                );
                const xNormal2_ = [xNormal2.x, xNormal2.y, xNormal2.z];
                const yNormal2 = Cesium.Matrix4.multiplyByVector(
                    modelMatrix,
                    new Cesium.Cartesian4(0, 1, 0, 1),
                    new Cesium.Cartesian4()
                );
                const yNormal2_ = [yNormal2.x, yNormal2.y, yNormal2.z];
                const zNormal2 = Cesium.Matrix4.multiplyByVector(
                    modelMatrix,
                    new Cesium.Cartesian4(0, 0, 1, 1),
                    new Cesium.Cartesian4()
                );
                const zNormal2_ = [zNormal2.x, zNormal2.y, zNormal2.z];
                const rotationMatrixValues = getRotation(
                    xNormal1,
                    yNormal1,
                    zNormal1,
                    xNormal2_,
                    yNormal2_,
                    zNormal2_
                );
                const rotationMatrix = Cesium.Matrix3.fromArray(rotationMatrixValues);
                let hpr = Cesium.Quaternion.fromRotationMatrix(rotationMatrix, new Cesium.Quaternion());
                hpr = Cesium.HeadingPitchRoll.fromQuaternion(hpr);
                const qua=Cesium.Transforms.headingPitchRollQuaternion(center,hpr,Cesium.Ellipsoid.WGS84,Cesium.Transforms.localFrameToFixedFrameGenerator("north","west"),new Cesium.Quaternion())
                console.log(qua);
                this.viewer.entities.add({
                    position: center,
                    orientation: qua,
                    model: {
                        uri: "car.gltf"
                    }
                });
            },

            Cesium.ScreenSpaceEventType.RIGHT_CLICK,
            Cesium.KeyboardEventModifier.CTRL
        );
    }
    showLoadingTiles() {
        const loadingTilesTree =
            this.viewer.scene.globe._surface._tilesToRender;
        const tilesList = [];
        const tilesBoundings = [];
        loadingTilesTree.forEach((item) => {
            tilesList.push([item._x, item._y, item._level]);
            item._rectangle.level = item._level;
            tilesBoundings.push(item._rectangle);
        });
        console.log("当前需要加载的瓦片列表:", tilesList);
        console.log(tilesBoundings);
        this.tilesBoundingSource.entities.removeAll();

        tilesBoundings.forEach((rec) => {
            const center = Cesium.Rectangle.center(
                rec,
                new Cesium.Cartographic()
            );
            const position = Cesium.Cartesian3.fromRadians(
                center.longitude,
                center.latitude
            );
            console.log(position);
            this.tilesBoundingSource.entities.add({
                position: position,
                rectangle: {
                    coordinates: rec,
                    outlineColor: Cesium.Color.fromAlpha(Cesium.Color.RED, 0.5),
                    outlineWidth: 20,
                    outline: true,
                    fill: false,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                },
                label: {
                    text: `${rec.level}`,
                    font: "30px",
                    fillColor: Cesium.Color.YELLOW,
                    show: true,
                },
            });
        });
    }
}
export default new Map3D();
