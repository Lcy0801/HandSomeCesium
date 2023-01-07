void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
    vec3 v1=vsInput.positionMC-center;
    flat flag=dot(v1,normal);
    vec3 v2;
    if(flag<0){
        v2=-flag*normal;
    }else{
        v2=flag*normal;
    }
    vec3 v3=v1-v2;
    vec3 res=center+v3;
    vsInput.positionMC=res;
}