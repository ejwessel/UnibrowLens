// -----JS CODE-----
// AdaptToDeviceController_brows.js
// Version: 0.0.1
// Event: Initialized
// Description: This script demonstrates how you can adapt your ML Lenses based on device performance. 
// Notes: This script is based on StyleTransferController, except adapted for the brows model

//@ui {"widget":"label", "label":"Brows Controls"}
//@input float interpolationValue = 0.7 {"widget":"slider", "label":"Brows Intensity", "min":0.0, "max":1.0, "step":0.01}
//@ui {"widget":"separator"}
//@input Component.MLComponent mlComponent
//@input int runMode = 1 {"widget":"combobox", "values":[{"label":"Adapt to Device Performance", "value":1}, {"label":"Run Always", "value":2}, {"label":"Run on Tap", "value":3}]}

//@input Component.MaterialMeshVisual outputImage

//@ui {"widget":"separator"}
//@input bool advanced
//these names have to match your model input and output names
//@input string input1Name = "data" {"showIf" : "advanced"}
//@input string input2Name = "cond" {"showIf" : "advanced"}
//@input string output1Name = "output_0" {"showIf" : "advanced"}
//@input string output2Name = "output_1" {"showIf" : "advanced"}
//@ui {"widget":"separator", "showIf" : "advanced"}
//@input SceneObject camera {"showIf" : "advanced"}
//@input Asset.Texture cropTexture {"showIf" : "advanced"}
//@ui {"widget":"separator", "showIf" : "advanced"}
//@input SceneObject loader {"showIf" : "advanced"}
//@input SceneObject photoButton  {"showIf" : "advanced"}
//@input SceneObject resetButton  {"showIf" : "advanced"}


var mlComponent;
var config;
var currentDevicePerformanceIndex;
var frameProcessed = false;
var nextFrameDisableCamera = false;

// If using `Adapt to Device Performance` mode and 
// current device's  ML performance index is less 
// than this value, Lens will use `Run on Tap` mode.
var lowMLPerformanceIndexBreakpoint = 4;

// Brows variable
var interpolationValue = script.interpolationValue;

function init() {
    if (!checkAllInputSet()) {
        return;
    }

    // Brows Face Crop Position
    script.cropTexture.control.faceCenterMouthWeight = -0.3;


    mlComponent = script.mlComponent;
    mlComponent.onLoadingFinished = wrapFunction(mlComponent.onLoadingFinished, onMLLoaded);
    mlComponent.build([]);

    // Represents the device's ML performance.
    // The higher the number, the faster the performance.
    // As of April 2020, the range of index is (0 - 8).
    // As more performant device become available, the maximum index will increase.

    currentDevicePerformanceIndex = global.deviceInfoSystem.performanceIndexes.ml;
}

function onMLLoaded() {
    config = getConfig();

    if (config) {
        setupRunSettings(currentDevicePerformanceIndex);

        // Brows Set up
        updateConditionDataInput();
    }
}

function getConfig() {
    
    var mlInput1;
    var mlInput2;
    var mlOutput1;
    var mlOutput2;
    
    try {
        mlInput1 = mlComponent.getInput(script.input1Name);
    } catch (e) {
        debugPrint(e + ". Please set valid Input 1 Name that is matching MLAsset output name");
        return null;
    }
    if (!mlInput1.texture) {
        mlInput1.texture = script.cropTexture;
    }
    
    try {
        mlInput2 = mlComponent.getInput(script.input2Name);
    } catch (e) {
        debugPrint(e + ". Please set valid Input 2 Name that is matching MLAsset output name");
        return null;
    }
    
    try {
        mlOutput1 = mlComponent.getOutput(script.output1Name);
    } catch (e) {
        debugPrint(e + ". Please set valid Output 1 Name that is matching MLAsset output name");
        return null;
    }
    if (!mlOutput1.texture) {
        debugPrint("Error, Please create Output Texture on the ML Component");
    }

    try {
        mlOutput2 = mlComponent.getOutput(script.output2Name);
    } catch (e) {
        debugPrint(e + ". Please set valid Output 2 Name that is matching MLAsset output name");
        return null;
    }
    if (!mlOutput2.texture) {
        debugPrint("Error, Please create Output Texture on the ML Component");
    }

    return {
        input1 : mlInput1,
        input2 : mlInput2,
        output1: mlOutput1,
        output2: mlOutput2
    };
}

function setupRunSettings(index) {
    var shouldRunOnDemand = (script.runMode == 1 && index < lowMLPerformanceIndexBreakpoint) || (script.runMode == 3);

    if (shouldRunOnDemand) {
        runOnDemand();
    } else {
        runAlways();
    }
}

function runAlways() {
    mlComponent.runScheduled(true, MachineLearning.FrameTiming.OnRender, MachineLearning.FrameTiming.OnRender);
    mlComponent.onRunningFinished = wrapFunction(mlComponent.onRunningFinished, onMLFinishedProcessingFirstFrame);
    setOutputTexture(false);   
}
// on demand functions
function runOnDemand() {

    mlComponent.onRunningFinished = wrapFunction(mlComponent.onRunningFinished, onMLFinishedProcessing);

    script.createEvent("TapEvent").bind(onTap);

    script.createEvent("UpdateEvent").bind(function () {
        if (nextFrameDisableCamera) {
            if (script.camera) { script.camera.enabled = false; }
        }
    })

    if (script.loader) { script.loader.enabled = false; }
    if (script.photoButton) { script.photoButton.enabled = true; }

    setOutputTexture(false);
}

function onTap() {
    if (mlComponent.state == MachineLearning.ModelState.Idle) {
        if (!frameProcessed) {
            runOnce();
        }
        else {
            reset();
        }
    }
}

function runOnce() {
    mlComponent.runImmediate(false);

    if (script.loader) { script.loader.enabled = true; }
    if (script.photoButton) { script.photoButton.enabled = false; }

    frameProcessed = true;
}

function onMLFinishedProcessing() {

    setOutputTexture(true);
    if (script.loader) { script.loader.enabled = false; }
    if (script.resetButton) { script.resetButton.enabled = true; }

    nextFrameDisableCamera = true;
}

function onMLFinishedProcessingFirstFrame() {
    if (!frameProcessed) {
        setOutputTexture(true);
        if (script.loader) { script.loader.enabled = false; }
        frameProcessed = true;
    }
}

function reset() {

    setOutputTexture(false);

    if (script.photoButton) { script.photoButton.enabled = true; }
    if (script.resetButton) { script.resetButton.enabled = false; }

    if (script.camera) { script.camera.enabled = true; }
    nextFrameDisableCamera = false;

    frameProcessed = false;
}

function setOutputTexture(fromOutput) {
    if (fromOutput) {
        script.outputImage.enabled = true;
        script.outputImage.mainPass.baseTex = config.output1.texture;
        script.outputImage.mainPass.overlayTex = config.output2.texture;
    } else {
        script.outputImage.enabled = false;
    }
}

// Brows data input
function updateConditionDataInput() {
    interpolationValue = clamp(interpolationValue, 0.0, 1.0);
    var value = interpolationValue;
    var arr = [value * 2, value * 2];
    arr = new Float32Array(arr);
    config.input2.data.set(arr);
    return;
}

function clamp(v, a, b) {
    return Math.min(Math.max(a, v), b)
}

function checkAllInputSet() {
    // Brows check
    if (!script.cropTexture) {
        debugPrint("Error: Please assign Crop Texture");
        return false;
    }

    if (!script.mlComponent) {
        debugPrint("Error: Please assign an ML Component which has a proxy texture output");
        return false;
    }

    if (!script.outputImage) {
        debugPrint("Error: Please assign Output Image to display output texture on");
        return false;
    }

    if (!script.camera) {
        debugPrint("Error: Camera is not set");
        return false;
    }

    if (!script.loader) {
        debugPrint("Warning: Loader Object is not set ");
    }

    if (!script.photoButton) {
        debugPrint("Warning: Photo Button is not set");
    }
    else {
        script.photoButton.enabled = false;
    }

    if (!script.resetButton) {
        debugPrint("Warning: Reset Button is not set");
    }
    else {
        script.resetButton.enabled = false;
    }
    return true;
}

function debugPrint(text) {
    print("AdaptToDeviceController_brows, " + text);
}

function wrapFunction(origFunc, newFunc) {
    if (!origFunc) {
        return newFunc;
    }
    return function () {
        origFunc();
        newFunc();
    };
}

init();