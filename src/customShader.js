/*
 * @Author: zhouwh
 * @Date: 2022-01-09 11:31:24
 * @LastEditTime: 2022-01-09 15:31:24
 * @Description: 倾斜摄影压平方法
 */

// 倾斜摄影数组
let modelArr = []
let tilesetModel = null
let url = 'http://earthsdk.com/v/last/Apps/assets/dayanta/tileset.json'

// 添加3dTiles倾斜模型
export function add3DTiles () {
	viewer.scene.globe.depthTestAgainstTerrain = true;
	tilesetModel = new Cesium.Cesium3DTileset({
		url: url,
		minimumPixelSize: 128,
		customShader: new Cesium.CustomShader({
			uniforms: {
				// 判断是否开启压平
				v_if: {
					type: Cesium.UniformType.BOOL,
					value: false
				},
				// 压平值
				v_z: {
					type: Cesium.UniformType.FLOAT,
					value: 0.0
				}
							},
			varyings: {
				// 压平区域
				v_area: Cesium.VaryingType.VEC3
			},
			// 局部压平通过vsInput.attributes.positionMC.x<10.0 &&vsInput.attributes.positionMC.y<10.0实现（模型内部坐标筛选），可传入varyings使用
			vertexShaderText: `
				 void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
		 	if(v_if&& vsInput.attributes.positionMC.x<10.0 &&vsInput.attributes.positionMC.y<10.0){
		 		vsOutput.positionMC = vec3(vsInput.attributes.positionMC.x, vsInput.attributes.positionMC.y, v_z);
		 	}else{
		 		vsOutput.positionMC = vec3(vsInput.attributes.positionMC.x, vsInput.attributes.positionMC.y, vsInput.attributes.positionMC.z);
		 	}
		 }

			fragmentShaderText: `
		 void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
			
		  }`
		}),
		enableModelExperimental: true

	});
	tilesetModel.readyPromise.then(function (argument) {
		let heightOffset = 0; // 调整倾斜摄影高度，防止飘和进入地下
		let boundingSphere = tilesetModel.boundingSphere;
		let cartographic = Cesium.Cartographic.fromCartesian(boundingSphere.center);
		let surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
		let offset = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, heightOffset);
		let translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
		tilesetModel.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
		viewer.scene.primitives.add(tilesetModel);
		modelArr.push(tilesetModel)



	});

}

export function setModelHeight (val) {
	tilesetModel.customShader.setUniform('v_z', val)

}

export function setOpenModelHeight (val) {
	tilesetModel.customShader.setUniform('v_if', val)

}



// 移除3d模型
export function removeModel () {
	if (modelArr.length > 0) {
		modelArr.forEach((item, index) => {
			viewer.scene.primitives.remove(item);
			modelArr.splice(index, 1)
			
		})
	}
	

}

