import * as Cesium from "cesium";
import { CesiumToken } from "./mapconfig";
import { planeFit } from "./utils";
import flattenData from "./flattenArea.json";

// 默认的压平高度
const defaultFlattenHeight = 0;
class Map3D {
	initMap(container) {
		Cesium.Ion.defaultAccessToken = CesiumToken;
		this.viewer = new Cesium.Viewer(container, {
			timeline: false,
			animation: false,
			shouldAnimate: true,
		});
		window.viewer = this.viewer;
		window.Cesium = Cesium;
		const flattenAreas = [];
		flattenData.features.forEach((feature) => {
			if (feature.geometry.type.toLowerCase() === "polygon") {
				const flattenAreaPoints = feature.geometry.coordinates[0].map(
					(poi) => {
						if (poi.length === 2) {
							return Cesium.Cartesian3.fromDegrees(
								poi[0],
								poi[1],
								defaultFlattenHeight
							);
						} else {
							return Cesium.Cartesian3.fromDegrees(
								poi[0],
								poi[1],
								poi[2]
							);
						}
					}
				);
				flattenAreas.push(flattenAreaPoints);
			} else {
				feature.geometry.coordinates.forEach((polygon) => {
					const flattenAreaPoints = polygon[0].map((poi) => {
						if (poi.length === 2) {
							return Cesium.Cartesian3.fromDegrees(
								poi[0],
								poi[1],
								defaultFlattenHeight
							);
						} else {
							return Cesium.Cartesian3.fromDegrees(
								poi[0],
								poi[1],
								poi[2]
							);
						}
					});
					flattenAreas.push(flattenAreaPoints);
				});
			}
		});

		const flattenAreas_ = flattenAreas.map((flattenArea) => {
			return this.processFlattenArea(flattenArea);
		});
		let flattenAreasParameters = [];
		let flattenAreasPoints = [];

		flattenAreas_.forEach((flattenAreaOption) => {
			const startIndex = flattenAreasPoints.length / 3;
			debugger;
			const pointsNum = flattenAreaOption.flattenAreaWCxyz.length / 3;
			const endIndex = startIndex + pointsNum - 1;
			flattenAreasParameters = flattenAreasParameters.concat([
				...flattenAreaOption.planeNormal,
				flattenAreaOption.center.x,
				flattenAreaOption.center.y,
				flattenAreaOption.center.z,
				startIndex,
				endIndex,
				pointsNum,
			]);
			flattenAreasPoints = flattenAreasPoints.concat(
				flattenAreaOption.flattenAreaWCxyz
			);
		});
		debugger;
		// 着色器uniforms
		const uniforms = {
			//压平区域的个数
			flattenAreasCount: {
				type: Cesium.UniformType.FLOAT,
				value: flattenAreas_.length,
			},
			flattenAreasPointsCount: {
				type: Cesium.UniformType.FLOAT,
				value: flattenAreasPoints.length / 3,
			},
			//以纹理贴图的形式记录每一个压平区域的法线、重心坐标和边界点起止索引
			flattenAreasParameters: {
				type: Cesium.UniformType.SAMPLER_2D,
				value: new Cesium.TextureUniform({
					typedArray: new Float32Array(flattenAreasParameters),
					width: 6,
					height: 1,
					pixelFormat: Cesium.PixelFormat.RGB,
					pixelDatatype: Cesium.PixelDatatype.FLOAT,
					repeat: false,
				}),
			},
			//以纹理贴图的形式记录每一个压平区域的边界点坐标
			flattenAreasPoints: {
				type: Cesium.UniformType.SAMPLER_2D,
				value: new Cesium.TextureUniform({
					typedArray: new Float32Array(flattenAreasPoints),
					width: flattenAreasPoints.length / 3,
					height: 1,
					pixelFormat: Cesium.PixelFormat.RGB,
					pixelDatatype: Cesium.PixelDatatype.FLOAT,
					repeat: false,
				}),
			},
		};
		debugger;
		// 拟合模型平面
		const vertexShaderText = `
		void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
			const float maxNumflattenAreas = 10.0;
			const float maxNumflattenPoints = 100.0;
			if(flattenAreasCount > maxNumflattenAreas || flattenAreasPointsCount > maxNumflattenAreas * maxNumflattenPoints)
			{
				return;
			}
    		vec4 positionMC_ = vec4(vsInput.attributes.positionMC , 1);
			vec4 positionWC_ = czm_model * positionMC_;
			float pi = 3.1415926;
			for (float i = 0.0; i < maxNumflattenAreas; i++)
			{
				if(i >= flattenAreasCount)
				{
					break;
				}
				vec3 planeNormal = texture2D(flattenAreasParameters , vec2((i*3.0*2.0+1.0)/(flattenAreasCount*3.0*2.0),0.5)).rgb;
				vec3 flattenAreaCenter = texture2D(flattenAreasParameters , vec2(((i*3.0+1.0)*2.0+1.0)/(flattenAreasCount*3.0*2.0),0.5)).rgb;
				vec3 SEN = texture2D(flattenAreasParameters , vec2(((i*3.0+2.0)*2.0+1.0)/(flattenAreasCount*3.0*2.0),0.5)).rgb;
				float start = SEN.x;
				float end = SEN.y;
				float flattenAreaPointsCount = SEN.z;
				if (flattenAreaPointsCount > maxNumflattenPoints)
				{
					continue;
				}
				float lambda = (dot(planeNormal , positionWC_.xyz) - dot(planeNormal , flattenAreaCenter)) / dot(planeNormal , planeNormal);
				vec3 positionOnPlane = positionWC_.xyz - lambda * planeNormal;
				float angle = 0.0;
				for(float j = 0.0; j < maxNumflattenPoints ; j++)
				{
					if (j == flattenAreaPointsCount - 1.0)
					{
						break;
					}
					float index1 = start + j;
					float index2 = index1 + 1.0;
					vec3 point1 = texture2D(flattenAreasPoints , vec2( (index1 * 2.0 + 1.0)/(flattenAreasPointsCount * 2.0) , 0.5)).rgb;
					vec3 point2 = texture2D(flattenAreasPoints , vec2( (index2 * 2.0 + 1.0)/(flattenAreasPointsCount * 2.0) , 0.5)).rgb;
					vec3 v1 = normalize(point1 - positionOnPlane);
					vec3 v2 = normalize(point2 - positionOnPlane);
					angle = angle + acos(dot(v1 , v2 ));
				}
				if ( abs(angle - 2.0 * pi) < 0.1){
					vec4 positionOnPlane_ = vec4( positionOnPlane , 1);
					positionMC_ = czm_inverseModel * positionOnPlane_;
					break;
				}
			}
			vsOutput.positionMC = positionMC_.xyz;
  		}
		`;
		const tileset = this.viewer.scene.primitives.add(
			new Cesium.Cesium3DTileset({
				url: "https://rc-cdn.wzw.cn/project3D/3DTiles/wangu3DTiles/tileset.json",
				show: true,
				customShader: new Cesium.CustomShader({
					uniforms: uniforms,
					vertexShaderText: vertexShaderText,
				}),
			})
		);
		window.tileset = tileset;
		this.viewer.camera.setView({
			destination: new Cesium.Cartesian3(
				-2849064.3219735557,
				4649712.330545548,
				3297976.816533938
			),
			orientation: new Cesium.HeadingPitchRoll(
				6.2831853071792185,
				-0.5001302048755556,
				0
			),
		});
		const that = this;
		this.viewer.screenSpaceEventHandler.setInputAction((event) => {
			const position = that.viewer.scene.pickPosition(event.position);
			const position_ = Cesium.Cartographic.fromCartesian(position);
			const lon = Cesium.Math.toDegrees(position_.longitude);
			const lat = Cesium.Math.toDegrees(position_.latitude);
			console.log(lon, lat);
		}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
	}
	//对压平区域的数据进行预处理
	processFlattenArea(flattenAreaWC) {
		//绘制压平区域
		this.viewer.entities.add({
			polyline: {
				positions: [...flattenAreaWC, flattenAreaWC[0]],
				material: Cesium.Color.RED,
			},
		});
		//拟合压平区域平面
		const flattenAreaWC_ = flattenAreaWC.map((point) => {
			return [point.x, point.y, point.z];
		});
		const [a, b, c] = planeFit(flattenAreaWC_);
		const flattenAreaWC__ = Cesium.Cartesian3.packArray(flattenAreaWC);
		const flattenAreaCenter_ = flattenAreaWC.reduce(
			(previousV, cueerntV) => {
				return Cesium.Cartesian3.add(
					previousV,
					cueerntV,
					new Cesium.Cartesian3()
				);
			},
			new Cesium.Cartesian3()
		);
		const flattenAreaCenter = Cesium.Cartesian3.divideByScalar(
			flattenAreaCenter_,
			flattenAreaWC.length,
			new Cesium.Cartesian3()
		);
		return {
			center: flattenAreaCenter,
			planeNormal: [a, b, c],
			flattenAreaWCxyz: flattenAreaWC__,
		};
	}
}
export default new Map3D();
