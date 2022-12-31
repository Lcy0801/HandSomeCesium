import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import { planeFit } from "./utils";
import * as mathjs from "mathjs";

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
                url: Cesium.IonResource.fromAssetId(1)
            })
        });
        // this.showAxis();
        this.planeFit();
    }
    //绘制笛卡尔坐标系的三个轴
    showAxis(){
        //地球的平均半径是6378137m
        const radius=6500000;
        const zPoint=new Cesium.Cartesian3(0,0,radius);
        const yPoint=new Cesium.Cartesian3(0,radius,0);
        const xPoint=new Cesium.Cartesian3(radius,0,0);
        const axisDataSource=new Cesium.CustomDataSource("axis");
        this.viewer.dataSources.add(axisDataSource);
        axisDataSource.entities.add({
            id:"xAxis",
            position:xPoint,
            label:{
                text:'x'
            }
        });
        axisDataSource.entities.add({
            id:"yAxis",
            position:yPoint,
            label:{
                text:'y'
            }
        });
        axisDataSource.entities.add({
            id:"zAxis",
            position:zPoint,
            label:{
                text:'z'
            }
        });
    }
    planeFit() {
        // 平面拟合demo
        const viewer = this.viewer;
        const pickDataSource = new Cesium.CustomDataSource("pickPoint");
        viewer.dataSources.add(pickDataSource);
        this.viewer.screenSpaceEventHandler.setInputAction((event) => {
            viewer.entities.removeById("fitPlane");
            viewer.entities.removeById("normal");
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
        this.viewer.screenSpaceEventHandler.setInputAction((event) => {
            document.getElementById("container").style.cursor = "default";
            let points = [];
            pickDataSource.entities.values.forEach(entity => {
                points.push([
                  entity.position._value.x,
                  entity.position._value.y,
                  entity.position._value.z,
                ]);
            });
            const [a, b, c] = planeFit(points);
            pickDataSource.entities.removeAll();
            const points_ = points.map(point => {
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
                    material: new Cesium.ColorMaterialProperty(Cesium.Color.RED),
                    
                }
            });
            //绘制法线
            let normal = Cesium.Cartesian3.normalize(
              new Cesium.Cartesian3(a, b, c),new Cesium.Cartesian3()
            );
            debugger;
            const flag = Cesium.Cartesian3.dot(new Cesium.Cartesian3(a, b, c), new Cesium.Cartesian3(0, 0, 1));
            if (flag < 0) {
                normal = Cesium.Cartesian3.normalize(
                    new Cesium.Cartesian3(-a, -b, -c),new Cesium.Cartesian3()
                );
            } 
            let center = points_.reduce((preV, curV) => { return Cesium.Cartesian3.add(preV, curV, new Cesium.Cartesian3()); }, new Cesium.Cartesian3());
            center = Cesium.Cartesian3.divideByScalar(center, points_.length,new Cesium.Cartesian3());
            let target = Cesium.Ray.getPoint(new Cesium.Ray(center, normal), 100,new Cesium.Cartesian3());
            const normalEntity = viewer.entities.add({
                id: "normal",
                polyline: {
                    positions: [center, target],
                    material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.BLUE),
                    width:3
                }
            });
            viewer.zoomTo(normalEntity);
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK, Cesium.KeyboardEventModifier.CTRL);
    }

}
export default new Map3D();
