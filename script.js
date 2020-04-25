doFreeze = false
doSweep = false
doSelectionFFT = false
selectStartPoint = true
selectionStart = 0
selectionEnd = 0

function handleCanvasClick(canvas, event) {
  const rect = canvas.getBoundingClientRect()
  const pxx = event.clientX - rect.left
  const pxy = event.clientY - rect.top
  const x = pxx/canvas.width
  const y = pxy/canvas.height

  if(selectStartPoint){
    selectionStart = x
  }else{
    selectionEnd = x
  }
  selectStartPoint = !selectStartPoint

  if(selectionEnd < selectionStart){
    var temp = selectionEnd
    selectionEnd = selectionStart
    selectionStart = temp
    selectStartPoint = !selectStartPoint
  }
  updateSelection(selectionStart,selectionEnd)
}

function updateSelection(newselectionStart,newselectionEnd){
  selectionStart = newselectionStart
  selectionEnd = newselectionEnd
  var canvas = document.getElementById('oscCanvas')
  const rect = canvas.getBoundingClientRect()
  document.getElementById("highlightDiv").style.width = selectionEnd * canvas.width - selectionStart * canvas.width
  document.getElementById("highlightDiv").style.left = rect.left + selectionStart * canvas.width
  if(doSelectionFFT){
    graphFFTSelection()
  }else{
    graphSelection()
  }
}


getRecentAudio = function(sampleCount){}

window.onload = function(){
  document.getElementById('oscCanvas').addEventListener('click', function(e) {
      handleCanvasClick(document.getElementById('oscCanvas'), e)
  })
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  var muteNode = audioCtx.createGain();
  muteNode.gain.setValueAtTime(0,audioCtx.currentTime)
  var muted = document.getElementById("mutebox").checked
  document.getElementById("mutebox").addEventListener("change", event => {
    muted = document.getElementById("mutebox").checked
    if(muted)
      muteNode.gain.setValueAtTime(0,audioCtx.currentTime)
    else
      muteNode.gain.setValueAtTime(1,audioCtx.currentTime)
  })
  doFreeze = document.getElementById("freezebox").checked
  document.getElementById("freezebox").addEventListener("change", event => {
    doFreeze = document.getElementById("freezebox").checked
  })
  doSelectionFFT = document.getElementById("fftbox").checked
  document.getElementById("fftbox").addEventListener("change", event => {
    doSelectionFFT = document.getElementById("fftbox").checked
    if(doSelectionFFT){
      graphFFTSelection()
    }else{
      graphSelection()
    }
  })
  var scriptNode = audioCtx.createScriptProcessor(0, 1, 1);
  const recentAudioBuffersCount = 50
  recentAudioBuffer = new Float32Array(scriptNode.bufferSize * recentAudioBuffersCount)
  var recentAudioBufferIndex = 0

  scriptNode.onaudioprocess = function(ape){
    if(!doFreeze){
      recentAudioBuffer.set(ape.inputBuffer.getChannelData(0),recentAudioBufferIndex)
      recentAudioBufferIndex = (recentAudioBufferIndex + ape.inputBuffer.length) % recentAudioBuffer.length
    }
  }

  getRecentAudio = (sampleCount => {
    if(recentAudioBufferIndex < sampleCount){
      var outArr = new Float32Array(sampleCount)
      outArr.set(recentAudioBuffer.subarray(recentAudioBufferIndex - sampleCount))
      outArr.set(recentAudioBuffer.subarray(0,recentAudioBufferIndex),sampleCount - recentAudioBufferIndex)
      return outArr
    }
    return recentAudioBuffer.slice(recentAudioBufferIndex - sampleCount,recentAudioBufferIndex)
  })

  return // don't get mic

  if(navigator.mediaDevices.getUserMedia){
    navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, autoGainControl: false, noiseSuppression: false, channelCount: 1}}).then(stream => {
      theStream = stream
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(scriptNode);
      //scriptNode.connect(muteNode);
      //muteNode.connect(audioCtx.destination);
    }).catch(function(err){ console.log('The following microphone error occured: ' + err);})
  }else{
    alert('getUserMedia not supported on your browser!');
  }
  //requestAnimationFrame(drawFFTBars)
}

function handleScriptNodeEvent(audioProcessingEvent){
  audioProcessingEvent.inputBuffer
}

sizeZero = 2 ** 10
numSubDivs = 10
fourierSizes = []
for(var i = numSubDivs - 1; i > 0; i--){
  fourierSizes.push(sizeZero * 2**i)
}
//fourierSizes = [sizeZero * 32,sizeZero * 16, sizeZero * 8, sizeZero * 4, sizeZero * 2, sizeZero]

ffts = []
fftOut = []
fourierSizes.forEach(s => {
  ffts.push(new FFT(s,48000))
  fftOut.push([])
})

temporalSmoothing = 0.6

function setSineWave(){
  recentAudioBuffer = new Float32Array(fourierSizes[0])
  for(var i = 0; i < recentAudioBuffer.length; i++){
    recentAudioBuffer[i] = 0.25 * Math.sin((440 + 3 * 440 * i/recentAudioBuffer.length) * 2 * Math.PI * i /48000)
  }
  drawFFTBars()
}

function doBigFFT(){
  var dataArray = getRecentAudio(fourierSizes[0])
  ffts[0].forward(dataArray)
  fftRes = fixupFFT(ffts[0].spectrum)
  graphText("FFT of size " + fourierSizes[0])
  graphData(fftRes)
}

function graphBigSignal(){
  var dataArray = getRecentAudio(fourierSizes[0])
  graphText("Signal of size " + fourierSizes[0])
  graphData(dataArray)
}

function graphSelection(){
  var dataArray = getRecentAudio(fourierSizes[0])
  var startInd = Math.floor(selectionStart * fourierSizes[0])
  var endInd = Math.floor(selectionEnd * fourierSizes[0])
  var selectSize = endInd - startInd
  var selectedSlice = dataArray.slice(startInd,endInd)
  graphText("Signal of size " + selectSize + " (= " + (selectSize/48000).toFixed(3) + " seconds), starting at " + startInd)
  graphData(selectedSlice)
}

selectionFFTSize = 5

function graphFFTSelection(){
  var dataArray = getRecentAudio(fourierSizes[0])
  var startInd = Math.floor(selectionStart * fourierSizes[0])
  var endInd = Math.floor(selectionEnd * fourierSizes[0])
  var selectSize = endInd - startInd
  var selectedSlice = dataArray.slice(startInd,endInd)
  graphText("FFT (" + fourierSizes[selectionFFTSize] + ") of signal of size " + selectSize + " (= " + (selectSize/48000).toFixed(3) + " seconds), starting at " + startInd)
  var toFFT = new Float32Array(fourierSizes[selectionFFTSize])
  toFFT.set(selectedSlice)
  //toFFT.set(new Float32Array(fourierSizes[0] - selectedSize),selectedSize)
  ffts[selectionFFTSize].forward(toFFT)
  var fftRes = fixupFFT(ffts[selectionFFTSize].spectrum)
  graphData(fftRes)
}

function sweepSelection(selectSize){
  updateSelection(selectionStart + 0.001, selectionStart + 0.0011 + selectSize)
  if(selectionStart < 1 && doSweep == true){
    setTimeout(() => requestAnimationFrame(() => sweepSelection(selectSize)),100)
  }
}

function drawFFTBars(){
  var dataArray = getRecentAudio(fourierSizes[0])
  //yeetCanvas("spectrumCanvas")
  //drawLineL("spectrumCanvas",fftRes,-300,0,"rgba(0,0,233,255)",1,0)
  //drawTextL("spectrumCanvas",(getMainPeak(fftOut[i]).ix/(fourierSizes[i] * 2/48000)).toFixed(0),0,slFrac * sl,0.7 + (i/ffts.length) * 0.15)

  /*
  ffts.forEach((fft,i) => {
    var slFrac = fourierSizes[i]/fourierSizes[0]
    for(var sl = 0; sl < 1/slFrac; sl++){
      fft.forward(dataArray.slice(sl * fourierSizes[i],(sl + 1)*fourierSizes[i]))
      var fftRes = smoothen(0.4,fft.spectrum.map(x => 20 * Math.log10(2 * x/fft.spectrum.length)).slice(0,fft.spectrum.length/2))
      //fftOut[i] = fftRes
      for(var j = 0; j < fftRes.length; j++){
        var k = temporalSmoothing
        fftOut[i][j] = (fftOut[i][j] || 0) * k + fftRes[j] * (1 - k - 0.1)
        if(fftOut[i][j] < -800){
          fftOut[i][j] = -800
        }
        if(fftOut[i][j] > 0){
          fftOut[i][j] = 0
        }
      }
      drawLineL("spectrumCanvas",fftOut[i],-300,0,"rgba(0,0," + (10 + (245 * i)/fourierSizes.length) + ",255)",slFrac,slFrac * sl)
      drawTextL("spectrumCanvas",(getMainPeak(fftOut[i]).ix/(fourierSizes[i] * 2/48000)).toFixed(0),0,slFrac * sl,0.7 + (i/ffts.length) * 0.15)
    }
  })
  */

  yeetCanvas("oscCanvas")
  drawLine("oscCanvas",dataArray,-2,2,"rgba(150,0,30,100)")

  // Sliding FFT graph
  /*
  var slideVals = []
  var smallest = fourierSizes.length - 8
  for(var i = 0; i < (dataArray.length) - fourierSizes[smallest]; i++){
    ffts[smallest].forward(dataArray.subarray(i,i + fourierSizes[smallest]))
    //console.log(ffts[smallest].spectrum)
    var ffft = ffts[smallest].spectrum
    var peak = getMainPeak(ffft)
    //console.log(peak)
    var val = Math.max(0,Math.min(48000,peak.ix/(fourierSizes[smallest] * 2/48000)))
    if(!val && val !== 0){
      console.log(ffft)
      console.log(peak)
      console.log(val)
      slideVals.push(0)
    }else{
      slideVals.push(val)
    }
  }

  graphData(slideVals)
  */

  //requestAnimationFrame(drawFFTBars)
}

function doublingInterpolate(inData){
  var outData = new Float32Array(inData.length * 2)
  for(var i = 0; i < inData.length - 1; i++){
    outData[2 * i] = inData[i]
    outData[2 * i+1] = (inData[i] + inData[i + 1])/2
  }
  // Interpolate last value different because no endpoint past end of data
  outData[2 * (inData.length - 1)] = inData[inData.length - 1]
  outData[2 * (inData.length - 1) + 1] = inData[inData.length - 1] + outData[2 * (inData.length - 1)] - outData[2 * (inData.length - 1) - 1]
  return outData
}

function fixupFFT(unFixed){
  return unFixed.map(x => 20 * Math.log10(2 * x/unFixed.length)).slice(0,unFixed.length/2)
}

function graphText(textInfo){
  document.getElementById("graphReadout").innerHTML = textInfo
}
function graphData(theData){
  yeetCanvas("graphCanvas")
  var theMin = Math.min(...theData)
  var theMax = Math.max(...theData)
  drawLine("graphCanvas",theData,theMin,theMax,1,"#f0f")
  document.getElementById("graphSub").innerHTML = "min: " + theMin + ", max: " + theMax
}


function getMainPeak(datas){
  return datas.reduce((acc,cur,idx) => {
    if(cur > acc.val){
      return {ix: idx, val: cur}
    }
    return acc
  },{val: -Infinity})
}

function smoothen(k,xs){
  //xs[0] = 0
  for(var i = 1; i < xs.length; i++){
    xs[i] = k * xs[i-1] + (1-k) * xs[i]
  }
  return xs
}

function sft(inArr){
  var compArr = new Float32Array(inArr.length * 2)
  for(var i = 0; i < compArr.length; i+= 2){
    for(var j = 0; j < inArr.length; j++){
      compArr[i + 0] += inArr[j] * Math.cos(-2 * Math.PI * j * i / inArr.length)
      compArr[i + 1] += inArr[j] * Math.sin(-2 * Math.PI * j * i / inArr.length)
    }
  }
  var outArr = new Float32Array(inArr.length)
  for(var i = 0; i < compArr.length; i+= 2){
    outArr[i/2] = Math.sqrt(compArr[i] * compArr[i] + compArr[i + 1] * compArr[i + 1])
  }
  return outArr
}

function yeetCanvas(canvasName){
  var ctx = document.getElementById(canvasName).getContext("2d")
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height)
}

function drawTextL(canvasName,text,w,x0,y0){
  var ctx = document.getElementById(canvasName).getContext("2d")
  ctx.font = "13px Georgia"
  var fontHeight = 13
  ctx.textBaseline = "top"
  ctx.fillText(text,x0 * ctx.canvas.width,y0 * ctx.canvas.height)
}

function drawLineL(canvasName,dataPoints,minVal,maxVal,sty,w,x0){
  var ctx = document.getElementById(canvasName).getContext("2d")
  var pointDelta = w * ctx.canvas.width / dataPoints.length

  var maxHeight = ctx.canvas.height
  ctx.strokeStyle = sty
  ctx.beginPath()
  dataPoints.forEach((x,i) => {
    var y = maxHeight - (maxHeight/(maxVal - minVal)) * (x - minVal)
    ctx.lineTo(ctx.canvas.width * x0 + i * pointDelta,y)
  })
  ctx.stroke()
}
function drawLine(canvasName,dataPoints,minVal,maxVal,sty){
  var ctx = document.getElementById(canvasName).getContext("2d")
  var pointDelta = ctx.canvas.width / dataPoints.length

  ctx.font = "13px Georgia"
  var fontHeight = 13
  ctx.textBaseline = "top"

  var maxLabels = ctx.canvas.width/(fontHeight * 3)-1
  var labelDelta = Math.floor(dataPoints.length/maxLabels)

  var maxHeight = ctx.canvas.height - 2 * fontHeight
  ctx.strokeStyle = sty
  ctx.beginPath()
  dataPoints.forEach((x,i) => {
    var y = fontHeight + maxHeight - (maxHeight/(maxVal - minVal)) * (x - minVal)
    ctx.lineTo(i * pointDelta,y)
    if(i % labelDelta == 0){
      //ctx.fillText(x.toFixed(2),i * pointDelta,y - fontHeight)
      //ctx.fillText(i,i * pointDelta,maxHeight + fontHeight)
      ctx.moveTo(i * pointDelta,y)
    }
  })
  ctx.stroke()
}

function drawBars(canvasName,bars,minVal,maxVal,sty,doLabels){
  var ctx = document.getElementById(canvasName).getContext("2d")
  var barDelta = ctx.canvas.width / bars.length
  var barHalfGap = (1/10) * barDelta

  ctx.font = "13px Georgia"
  var fontHeight = 13
  ctx.textBaseline = "top"

  var maxLabels = ctx.canvas.width/(fontHeight * 4)-1
  var labelDelta = Math.floor(bars.length/maxLabels)

  var barMaxHeight = ctx.canvas.height - 2 * fontHeight
  bars.forEach((x,i) => {
    var barHeight = (barMaxHeight/(maxVal - minVal)) * (x - minVal)
    var topY = fontHeight + barMaxHeight - barHeight
    ctx.fillStyle = sty
    ctx.fillRect(i * barDelta + barHalfGap,topY, barDelta - 2 * barHalfGap, barHeight)
    if(i % labelDelta == 0 && doLabels){
      ctx.fillStyle = "rgba(0,0,255,255)"
      ctx.fillText(x.toFixed(2),i * barDelta,topY - fontHeight)
      ctx.fillText(i,i * barDelta,barMaxHeight + fontHeight)
    }
  })
  ctx.stroke()
}


function readInFile(){
  fileInput = document.getElementById('audio-file')
  if(fileInput.files[0] == undefined) {
    alert("No file uploaded")
    return
  }
  var fr = new FileReader()
  fr.onload = function(ev) {
    //console.log(fr)
    //console.log(fr.result)
    copy = fr.result.slice(0)
    audioCtx.decodeAudioData(copy).then(function(buffer) {
      recentAudioBuffer = new Float32Array(buffer.duration * buffer.sampleRate)
      buffer.copyFromChannel(recentAudioBuffer,0)
    })
  }
  fr.readAsArrayBuffer(fileInput.files[0])
}
