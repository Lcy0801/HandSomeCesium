attribute vec4 color;
varying vec4 v_color;
varying x

void main()
{
    vec4 p = czm_computePosition();
    vec4 eyePosition = czm_modelViewRelativeToEye * p;
    p =  czm_inverseModelView * eyePosition;
    vec4 worldPosition= czm_model * p;
    vec4 enuPosition=modelMatrix*worldPosition;
    float u=max(enuPosition.z,minHeight);
    float alpha=fract((u-minHeight)/(maxHeight-minHeight));
    v_color=vec4(color.rgb,alpha)
    gl_Position = czm_modelViewProjection * p;
}