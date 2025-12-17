import './style.css'
import "leaflet/dist/leaflet.css"
import 'leaflet'
import "leaflet-providers";
import citiesUrl from "/cities.geojson?url"
import "./leaflet-idw.js"

////////////////////////////
let samplingInterval = 20;
////////////////////////////

let currentBasemapTileLayer = null;

let startingPos = [53.26159858326952, -2.5108565553880653]

let map = L.map('map').setView(startingPos, 4);
map.setMinZoom(5);

let marker = L.marker([-74.96844941055646, 111.12319047388718]).addTo(map)

let northWest = [58.602350107374626, -13.348446523591717]
let southEast = [49.79435954086905, 3.5757293368531573]

const ANSWER_NORTH = 0;
const ANSWER_SOUTH = 1;

switchToBasemap("OpenStreetMap.Mapnik")

function switchToBasemap(key){
    if (currentBasemapTileLayer != null){
        map.removeLayer(currentBasemapTileLayer);
    }
    currentBasemapTileLayer = L.tileLayer.provider(key).addTo(map);
}

let citiesJson = null;

fetch (citiesUrl).then(response => {
    response.json().then((json) => {
        citiesJson = json;
        showIntroduction();
    })
})

function cityIsInBoxAboutPoint(city, x, y, xBoxSize, yBoxSize){
    let props = city["properties"];

    if (props.lng < x - (xBoxSize / 2)){
        return false;
    }

    if (props.lng > x + (xBoxSize / 2)){
        return false;
    }

    if (props.lat < y - (yBoxSize / 2)){
        return false;
    }

    if (props.lat > y + (yBoxSize / 2)){
        return false;
    }

    return true;
}

function shuffleArray(array) {
  	array.sort(function (a, b) {
    	return Math.random() - 0.5;
  	});
}

let numComplete = 0;
let cityQueue = null;
let xBoxSize = null;
let yBoxSize = null;


let Introduction = L.Control.extend({ 
  _container: null,
  options: {position: 'bottomright', },

  onAdd: function (map) {
    var div = L.DomUtil.create('div');
    div.className = "control-behind"

    let title = document.createElement("div");
    title.innerHTML = "Welcome to the North-South divide preference revealer.<br>Please choose your level of detail:"
    div.appendChild(title)

    let buttonTemplates = [
        {"text":"Just curious", "val":7},
        {"text":"Quite interested", "val":15},
        {"text":"I'm insane", "val":-1}
    ]

    buttonTemplates.forEach((template) =>{
        let button = document.createElement("button");
        button.innerText = template["text"] + " (Sample granularity: "+(template["val"]==-1?"all":template["val"])+")";
        button.style = "color:black;"
        button.val = template["val"]
        button.onclick = ()=>{
            samplingInterval = button.val;
            if (samplingInterval == -1){
                startComprehensive();
            } else {
                start();
            }
        };
        div.appendChild(button)
        div.appendChild(document.createElement("br"));
    })

    this._div = div;
    L.DomEvent.disableClickPropagation(this._div);
    L.DomEvent.disableScrollPropagation(this._div);
    return this._div;
  }
});

let introduction = new Introduction();

function showIntroduction(){
    introduction.addTo(map);
}

let Challenge = L.Control.extend({ 
  _container: null,
  options: {position: 'bottomright', },

  onAdd: function (map) {
    var div = L.DomUtil.create('div');
    div.className = "control-behind"
    div.style = "display:none;"
    this.topBar = document.createElement("div");
    this.topBar.style = "display:flex;justify-flex:space-between;"
    div.appendChild(this.topBar);
    this.goBack = document.createElement("div");
    this.goBack.style = "width:33%;text-align:left;";
    this.goBackText = document.createElement("span");
    this.goBackText.innerText = "back";
    this.goBackText.title = "Click here if you need to amend your previous answer"
    this.goBackText.style = "font-weight:normal;cursor:pointer;";
    this.goBack.appendChild(this.goBackText)    
    this.goBack.onclick = ()=>{
        if (numComplete == 0){
            alert("To go back to the menu, refresh the page.")
        } else {
            numComplete--;
            presentChallenge(cityQueue[numComplete])
        }
    };
    this.topBar.appendChild(this.goBack);
    this.question = document.createElement("div");
    this.question.style = "width:33%;"
    this.question.innerText = "Is X in the north or south?"
    this.topBar.appendChild(this.question);
    this.filler = document.createElement("div");
    this.filler.style = "width:33%;"
    this.topBar.appendChild(this.filler);
    this.northButton = document.createElement("button");
    this.northButton.innerText = "North";
    this.southButton = document.createElement("button");
    this.southButton.innerText = "South";
    div.appendChild(this.northButton);
    div.appendChild(document.createElement("br"))
    div.appendChild(this.southButton);
    this.northButton.className = "north";
    this.southButton.className = "south";

    this.northButton.onclick = ()=>{
        answerChallenge(ANSWER_NORTH, this.city);
    };

    this.southButton.onclick = ()=>{
        answerChallenge(ANSWER_SOUTH, this.city);
    };

    this._div = div;
    L.DomEvent.disableClickPropagation(this._div);
    L.DomEvent.disableScrollPropagation(this._div);
    return this._div;
  }
});

let challenge = new Challenge();
challenge.addTo(map);

function presentChallenge(city){
    map.setView([city.properties.lat, city.properties.lng], 7)
    marker.setLatLng([city.properties.lat, city.properties.lng])
    challenge.city = city;
    challenge.question.innerHTML = "Is "+city.properties.city+" in the North or South?<br>("+(numComplete+1)+"/"+cityQueue.length+")"
    challenge._div.style = "";
}

function answerChallenge(answer, city){
    city["properties"].northOrSouth = answer;
    challenge._div.style = "display:none;"
    numComplete++;
    console.log(numComplete)
    processNext();
}

function processNext(){
    if (numComplete == cityQueue.length){
        calculateResult();
        return;
    }
    presentChallenge(cityQueue[numComplete]);
}

function calculateResult(){
    console.log(cityQueue)
    let latlngs = cityQueue.map((city) => {
            return [city["properties"].lat, city["properties"].lng, city["properties"].northOrSouth]
        });
    console.log(latlngs);
    var idw = L.idwLayer(latlngs, {opacity: 0.65, cellSize: 5, exp: 2, max: 1}).addTo(map);
    map.setView(startingPos, 5)
    marker.setLatLng([-74.96844941055646, 111.12319047388718])
}

function getRandomFromArray(arr){
    return arr[Math.floor(Math.random() * arr.length)]
}

function start(){

    map.removeControl(introduction)

    let xRange = southEast[1] - northWest[1];
    let yRange = northWest[0] - southEast[0];

    let samplingIntervalX = samplingInterval;
    let samplingIntervalY  = Math.ceil(samplingInterval * (xRange/yRange)); //this might look like it's the wrong we round, but it's not. The effect is that the Y range (longer) has a lower sampling interval than the X range (shorter) - the result is MORE SAMPLES ON Y, BECAUSE THE RESOLUTION IS THEN SMALLER (FINER)

    let demarcationsX = Array(samplingIntervalX);
    let demarcationsY = Array(samplingIntervalY)

    xBoxSize = xRange / samplingInterval;
    yBoxSize = yRange / samplingInterval;

    for (let i = 0; i < samplingIntervalX; i++){
        demarcationsX[i] = northWest[1] + (xRange * (parseFloat(i)/samplingIntervalX))
    }

     for (let i = 0; i < samplingIntervalY; i++){
         demarcationsY[i] = southEast[0] + (yRange * (parseFloat(i)/samplingIntervalY))
     }

    cityQueue = [];

    for(let i = 0; i < demarcationsY.length; i++){
        for(let j = 0; j < demarcationsX.length; j++){
            let citiesInBox = [];
            for (let c = 0; c < citiesJson.features.length; c++){
                let city = citiesJson.features[c];                
                    if (cityIsInBoxAboutPoint(city, demarcationsX[j], demarcationsY[i], xBoxSize, yBoxSize)){
                        citiesInBox.push(city);                                            
                    }
                }
            if (citiesInBox.length > 0){
                let selectedCity = getRandomFromArray(citiesInBox)

                for (let r = 0; r < 20; r++){
                    if (selectedCity.isAlreadyInPool){
                        selectedCity = getRandomFromArray(citiesInBox);
                        console.log("Intervention! A city was already in the pool so we re-rolled. It was: "+selectedCity.properties.city)
                    } else {
                        break;
                    }
                }
                selectedCity.isAlreadyInPool = true;
                cityQueue.push(selectedCity)                
            }
        }
    }

    cityQueue = cityQueue.filter((item, index) => cityQueue.indexOf(item) === index); //reduce to unique elements

    shuffleArray(cityQueue)
   
    numComplete = 0;
    processNext();
}

function startComprehensive(){
    map.removeControl(introduction)
    cityQueue = citiesJson.features;
    shuffleArray(cityQueue);
    numComplete = 0;
    processNext();
}