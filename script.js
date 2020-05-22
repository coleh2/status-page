let header = document.querySelector("header");

populatePageHeader(header, data);

let announce = document.getElementById("announce");
populateAnnouncements(announce, data);


let main = document.querySelector("main");

removeLoadSpinner();

let stati = document.getElementById("stati");

let categoryNameCounts = {};
let testParents = {};

let queryParams = new URLSearchParams(location.search);

if(queryParams.has("filter")) {
    let filter = getTestProps(`{${queryParams.get("filter")}}`);

    if(Object.keys(filter).length > 0) document.getElementById("filter-heading").style.display = "block";

    addFilterChips(filter);
}


loadTestPage(data);

function loadTestPage(pageData) {

    //filter tests by query params
    
    let displayedTests =  [];

    if(queryParams.has("filter")) {
        let filter = getTestProps(`{${queryParams.get("filter")}}`);

        for(var i = 0; i < pageData.TestData.length; i++) {
            let props = getTestProps(pageData.TestData[i].Name);

            addSpecialProps(props, pageData.TestData[i]);
            
            if(matchProps(props, filter)) displayedTests.push(pageData.TestData[i])
        }
    } else displayedTests = pageData.TestData;

    //count category names in order to decide if
    //tests will be rendered as subheadings later
    for(var i = 0; i < displayedTests.length; i++) {
        let categoryName = getCategoryName(displayedTests[i].Name);

        //defaults
        if(!categoryNameCounts[categoryName]) categoryNameCounts[categoryName] = 0;

        categoryNameCounts[categoryName]++;
    }

    //move the disabled and in-maintenance tests to the bottom
    for(var i = 0; i < displayedTests.length; i++) {
        if(!statusCodeHasGraph(getTestStatusCodeFromObj(displayedTests[i]))) {
            displayedTests.push(displayedTests.splice(i, 1)[0]);
        }
    }

    //add each test to the list-- may use subheading or heading depending on amount of tests in category
    for(var i = 0; i < displayedTests.length; i++) {
        let thisTest = displayedTests[i];

        let categoryName = getCategoryName(thisTest.Name);
        let testStatusCode = getTestStatusCodeFromObj(thisTest);

        let testBody = makeEmptyBodyForStatus(testStatusCode);
        


        if(categoryHasSubheading(categoryName)) {
            let testSubheading = buildSubheading(thisTest,testStatusCode);
            
            testBody.appendChild(testSubheading);

            testBody.classList.add("level-2");
        }


        //add graph, if applicable. If not, substitute a placeholder
        if(statusCodeHasGraph(testStatusCode)) testBody.appendChild(buildTestGraph(thisTest));
        else testBody.appendChild(buildGraphPlaceholder());


        //if this category has a parent, the test should be added as a subheading, but otherwise, the test gets a new parent.
        if(testAlreadyHasParent(categoryName)) {
            addNewSubtest(testParents[categoryName], testBody);
        } else {
            //If the category has subheadings, they will hold their own details, but if not, then the main heading holds them. 
            let testParent = buildTestParent(categoryName, testStatusCode, categoryHasSubheading(categoryName) ? false : thisTest.Name);

            testParents[categoryName] = testParent;

            testParent.appendChild(testBody);

            stati.appendChild(testParent);
        }
    }

}




function addSpecialProps(basicProps, test) {
    let statusCode = getTestStatusCodeFromObj(test) + "";

    basicProps.status = [statusCode];
}

function testPageLoadedCallback(pageData) {
    loadTestPage(pageData);
}

function loadNewPage(pageID) {
    window["testPageLoadedCallback" + pageID] = testPageLoadedCallback;

    let url = `https://app.statuscake.com/Workfloor/PublicReportHandler.php?PublicID=${pageID}&callback=testPageLoadedCallback${pageID}`;

    let dynamicScriptElem = document.createElement("script");
    dynamicScriptElem.src = url;

    document.head.appendChild(dynamicScriptElem);
}

function populateAnnouncements(announce, data) {
    announce.innerHTML = data.Announce;

    let otherPages = announce.querySelector("blockquote:last-child sup:only-child");
    if(otherPages) {
        let pageArray = otherPages.textContent.trim().split(/[^\w\d]+/g);
        
        for(var i = 0; i < pageArray.length; i++) {
            if(pageArray[i] != "") {
                loadNewPage(pageArray[i]);
            }
        }
    }
}

function filterToString(filterRecord) {
    let filterRecordCopy = JSON.parse(JSON.stringify(filterRecord));

    if(filterRecordCopy.name == "status") {
        for(var i = 0; i < filterRecordCopy.filter.length; i++) {
            if(filterRecordCopy.filter[i].startsWith("!")) {
                filterRecordCopy.filter[i] = filterRecordCopy.filter[i].substring(1);
                filterRecordCopy.filter[i] = testCodeDescription(filterRecordCopy.filter[i]);
                filterRecordCopy.filter[i] = "not(" + filterRecordCopy.filter[i] + ")";
            } else {
                filterRecordCopy.filter[i] = testCodeDescription(filterRecordCopy.filter[i]);
            }
            
        }
    }

    return filterRecordCopy.filter.join(", ");
}

function makeFilterChip(filterRecord) {
    let chip = document.createElement("li");
    
    let nameDisplay = document.createElement("h5");
    nameDisplay.textContent = filterRecord.name + ": ";

    let filterDisplay = document.createElement("span");
    filterDisplay.textContent = filterToString(filterRecord);

    let filterDeleteButton = document.createElement("button");
    filterDeleteButton.innerHTML = "&times;"
    filterDeleteButton.onclick = function() {
        let url = window.location.toString();
        for(var i = 0; i < filterRecord.filter.length; i++) {
            url = url.replace(filterRecord.name + ":" + filterRecord.filter[i], "");
        }
        window.location.replace(url);
    }


    chip.appendChild(nameDisplay);
    chip.appendChild(filterDisplay);
    chip.appendChild(filterDeleteButton);

    return chip;
}

function addFilterChips(filters) {
    let filterDisplay = document.getElementById("filter-list");

    let filterNames = Object.keys(filters);
    for(var i = 0; i < filterNames.length; i++)
        if(filterNames[i] != "") {
            filterDisplay.appendChild(makeFilterChip({
                name: filterNames[i],
                filter: filters[filterNames[i]]
            }));
        }
}

function getUptimeDayCount() {
    if(window.innerWidth < 600) return 30;
    else return 90;
}

function roundToPlace(num, place) {
    return Math.round(num / place) * place;
}

function makeHorizontalLine(x, length) {
    let line = document.createElement("path");
    line.setAttribute("d",`M0,${x} l ${length},0`);
    line.classList.add("hor-line");
    return line;
}

function makeSvgText(y, x, text) {
    let textElem = document.createElement("text");
    textElem.setAttribute("y", y);
    textElem.setAttribute("x", x);
    textElem.textContent = text;

    return textElem;
}

function buildGraphOverlay(svg, scale, dataScale) {
    let midLine = makeHorizontalLine(scale.y/2, scale.x);
    svg.appendChild(midLine);

    let midText = makeSvgText(scale.y/2 + 6, 1, roundToPlace(dataScale/2, 1/100).toString().substring(0,4) + "s");
    svg.appendChild(midText);

    let topLine = makeHorizontalLine(1, scale.x);
    svg.appendChild(topLine);

    let topText = makeSvgText(11, 1, roundToPlace(dataScale, 1/100).toString().substring(0,4) + "s");
    svg.appendChild(topText);
    
}

function matchProps(props, filters) {

    let filterKeyArr = Object.keys(filters);

    let result = true;
    for(var i = 0; i < filterKeyArr.length; i++) {
        let filterName = filterKeyArr[i];
        let filter = filters[filterName];

        if(props[filterName]) {
            let filterPass = false;

            for(var j = 0; j < filter.length; j++) {
                let invert = filter[j].startsWith("!");
                
                let filterActualValue = invert ? filter[j].substring(1) : filter[j];

                if(invert) filterPass = !props[filterName].includes(filterActualValue);
                else filterPass = props[filterName].includes(filterActualValue);
                
                if(!filterPass) break;
            }

            if(!filterPass) result = false;
        } else {
            result = false;
        }

        

        if(result == false) break;
    }

    return result;
}

function reparseElement(elem) {
    elem.outerHTML = elem.outerHTML + "";
}

function generateDetailPoint(detailIndex,detailPoint, scale) {
    return `L ${detailIndex*scale.x}, ${scale.y-(detailPoint*scale.y)}`;
}

function findGraphScale(detailData) {
    let max = 0;
    for(var i = 0; i < detailData.length; i++) {
        if(detailData[i].average > max) max = detailData[i].average;
    }

    return max;
}

function getElemSize(elem) {
    let rect = elem.getBoundingClientRect();
    return {
        x: rect.width,
        y: rect.height
    };
}

function getDayPingAverages(detailData) {
    let days = {};
    let lastDay;
    for(var i = detailData.length - 1; Object.keys(days).length < getUptimeDayCount(); i--) {
        let entry = detailData[i];

        if(entry == undefined) {
            days[lastDay - 86400] = {
                average: 0,
                day: lastDay - 86400
            };

            lastDay -= 86400;

            continue;
        }

        let entryTime = Math.round(entry[0] / 1000);
        let day = entryTime - (entryTime % 86400);

        lastDay = day;

        if(isNaN(day)) alert(day);

        if(!days[day]) {
            days[day] = {
                accumulation: entry[1],
                average: entry[1],
                count: 1,
                day: day
            };
        } else {
            days[day].accumulation += entry[1];
            days[day].count++;
            days[day].average = days[day].accumulation / days[day].count;
        }
    }

    return Object.values(days);
}

function buildPingGraph(detailData, scale) {
    let displayedData = getDayPingAverages(detailData);
    let svg = document.createElement("svg");

    svg.setAttribute("height",scale.y);
    svg.setAttribute("width",scale.x);
    svg.setAttribute("viewBox",`0 0 ${scale.x} ${scale.y}`);
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");

    buildGraphOverlay(svg, scale, findGraphScale(displayedData));

    let graphPathDrawAttr = `M0,${scale.y - (displayedData[0].average*100) }`;
    for(var i = 0; i < displayedData.length; i++) {
        graphPathDrawAttr += generateDetailPoint(i/displayedData.length,displayedData[i].average/findGraphScale(displayedData), scale);
    }

    //graphPathDrawAttr += `L${scale.x},${scale.y} Z`;

    let graphPath = document.createElementNS("http://www.w3.org/2000/svg","path");

    graphPath.setAttribute("d", graphPathDrawAttr);

    svg.appendChild(graphPath);

    return svg;
}

function loadedPingGraphCb(testGraphElem, detailData) {
    removeSkeletonGraph(testGraphElem);

    let scale = getElemSize(testGraphElem);
    testGraphElem.appendChild(buildPingGraph(detailData,scale));

    reparseElement(testGraphElem.children[0]);
}

function loadedFineUptimeCb(testGraphElem, detailData) {
    removeSkeletonGraph(testGraphElem);

    let testGraphList = document.createElement("ul");

    for(var time = Date.now() / 1000, i = 0; i < getUptimeDayCount(); i++, time-=86400) {
        testGraphList.insertBefore(buildTestGraphNode(getDayUptimePercentage(detailData, time), (new Date(time*1000)).toLocaleDateString()), testGraphList.children[0]);
    }

    testGraphElem.appendChild(testGraphList);
}

function getDayUptimePercentage(uptimePeriods, day) {
    let dayStart = day - (day % 86400);
    let dayEnd = dayStart + 86400;

    let secsDown = 0;
    let hasData = false;

    for(var i = 0; i < uptimePeriods.length; i++) {
        let period = uptimePeriods[i];
        //if period covers day, just return the period's state
        if(period.Start_Unix < dayStart && period.End_Unix > dayEnd) {
            //if it was not online, mark as such
            if(period.anno && period.anno.startsWith("NO::")) return -1;

            if(period.Status == "Down") return 0;
            else return 100;
        }

        //period inside day
        if(period.Start_Unix > dayStart && period.End_Unix < dayEnd) {
            hasData = true;
            if(period.Status == "Down") secsDown += period.End_Unix - period.Start_Unix;
        }
        //period begins day
        if(period.Start_Unix < dayStart && period.End_Unix > dayStart) {
            hasData = true;
            if(period.Status == "Down") secsDown += period.End_Unix - dayStart;
        }
        //period ends day
        if(period.Start_Unix < dayEnd && period.End_Unix > dayEnd) {
            hasData = true;
            if(period.Status == "Down") secsDown += dayEnd - period.Start_Unix;
        }
    }

    let secondsInDaySoFar = 86400
    if(Date.now() / 1000 < dayEnd) secondsInDaySoFar = Math.round(Date.now() / 1000) % 86400

    if(hasData) return 100 - Math.round(secsDown / secondsInDaySoFar * 100);
    else return -1;
}

function detailDataLoadedCallback(testGraphElem,loadType) {
    testGraphElem.classList.add(`has-${loadType}`);
    return function(detailData) {
        if(loadType == "ping-graph") loadedPingGraphCb(testGraphElem, detailData);
        else if (loadType == "fine-uptime") loadedFineUptimeCb(testGraphElem, detailData);
    }
}

function loadPingGraph(testGraphElem, testID) {
    window["pingGraphRun" + testID] = detailDataLoadedCallback(testGraphElem,"ping-graph");
    let url = `https://app.statuscake.com/Workfloor/API/influx_public.php?Type=Chart&TestID=${testID}&tz=America/New_York&callback=pingGraphRun${testID}`;

    let dynamicScriptElem = document.createElement("script");
    dynamicScriptElem.src = url;

    document.head.appendChild(dynamicScriptElem);
}

function loadFineUptime(testGraphElem, testID) {
    window["fineUptimeRun" + testID] = detailDataLoadedCallback(testGraphElem,"fine-uptime");
    let url = `https://app.statuscake.com/Workfloor/Get.Status.Perioids.php?callback=fineUptimeRun${testID}&PublicID=TkQbVyBFG8&tz=America/New_York&VID=${testID}`;

    let dynamicScriptElem = document.createElement("script");
    dynamicScriptElem.src = url;

    document.head.appendChild(dynamicScriptElem);
}

function removeLoadSpinner() {
    let loadParent = document.getElementById("load-parent");
    loadParent.parentElement.removeChild(loadParent);
}

function clearAllChildren(element) {
    for(var i = 0; i < element.children.length; i++) {
        element.removeChild(element.children[i]);
    }
}

function populatePageHeader(header, data) {
    let headerImg = document.createElement("img");
    headerImg.src = data.LogoImage;
    header.appendChild(headerImg);

    let headerH1 = document.createElement("h1");
    headerH1.textContent = data.Title;
    header.appendChild(headerH1);
}

function makeEmptyBodyForStatus(testStatusCode) {
    let testBody = document.createElement("div");

    testBody.classList.add("test-body");
    testBody.classList.add(testCodeClassName(testStatusCode));
    testBody.setAttribute("data-test-state",testStatusCode);

    return testBody;
}

function addSectionHeader(text, parent) {
    let statiHeader = document.createElement("h2");
    statiHeader.textContent = text;
    parent.appendChild(statiHeader);
}

function testAlreadyHasParent(categoryName) {
    return testParents.hasOwnProperty(categoryName);
}

function buildTestParent(categoryName, testStatusCode, encodedName) {
    let testParent = document.createElement("div");

    testParent.classList.add("status");
    testParent.setAttribute("data-test-state",testStatusCode);
    testParent.classList.add(testCodeClassName(testStatusCode));

    //add the header, which has the primary title and primary state.
    testParent.appendChild(buildTestHead(categoryName, testStatusCode, encodedName || false));

    return testParent;
}

function addNewSubtest(testMainElem, newTestBody) {
    let testMainCurrentState = testMainElem.getAttribute("data-test-state");
    let thisTestSubtestCurrentState = newTestBody.getAttribute("data-test-state");

    let newMainTestStatusCode = testCodeCombination(testMainCurrentState,thisTestSubtestCurrentState);
    
    testMainElem.setAttribute("data-test-state",newMainTestStatusCode);

    let mainStatusTextElem = testMainElem.querySelector(".head span.status-display");

    mainStatusTextElem.textContent = testCodeDescription(newMainTestStatusCode);
    testMainElem.classList.remove(testCodeClassName(testMainCurrentState));
    testMainElem.classList.add(testCodeClassName(newMainTestStatusCode));
        
    testMainElem.appendChild(newTestBody);
    testMainElem.classList.add("has-level-2");
}

function categoryHasSubheading(categoryName) {
    return categoryNameCounts[categoryName] > 1;
}

function statusCodeHasGraph(testStatusCode) {
    return !(testStatusCode == 2 || testStatusCode == 3);
}

function buildTestHead(testName, testStatusCode, ) {
    let testHead = document.createElement("div");
    testHead.classList.add("head");

    let testTitle = document.createElement("h3");
    testTitle.textContent = testName;

    let testStatus = buildStatusState(testStatusCode);

    
    testHead.appendChild(testTitle);
    testHead.appendChild(buildNameStatusSeperator());
    testHead.appendChild(testStatus);

    return testHead;
}

function buildSubheading(thisTest, testStatusCode) {
    let testSubheading = document.createElement("h4");

    testSubheading.textContent = getTestName(thisTest.Name);

    testSubheading.appendChild(buildNameStatusSeperator());

    testSubheading.appendChild(buildStatusState(testStatusCode));

    return testSubheading;
}

function buildNameStatusSeperator() {
    let testTitleAndStatusSeperator = document.createElement("span");
    testTitleAndStatusSeperator.innerHTML = "&nbsp;-&nbsp;";

    return testTitleAndStatusSeperator;
}

function buildStatusState(testStatusCode) {
    let statusState = document.createElement("span");

    statusState.textContent = testCodeDescription(testStatusCode);
    statusState.classList.add("status-display");

    return statusState;
}

function buildGraphPlaceholder() {
    let parent = document.createElement("div");
    parent.classList.add("graph-parent");

    let placeholder = document.createElement("div");
    placeholder.classList.add("placeholder");

    parent.appendChild(placeholder);

    return parent;
}

function buildTestGraphNode(uptimePercentage, dateText) {
    let testUptimeNode = document.createElement("li");

    testUptimeNode.style.backgroundColor = makeGraphNodeBgColor(uptimePercentage / 100);
    if(uptimePercentage >= 0) {
        testUptimeNode.setAttribute("tooltip",`${dateText} - ${uptimePercentage}%`);
        testUptimeNode.classList.add("tooltip");
    }
    
    return testUptimeNode;
}

function buildTestGraph(testObject) {
    let testGraphGroup = document.createElement("div");
    testGraphGroup.classList.add("graph-group");
    
    let testProps = getTestProps(testObject.Name);

    if(testProps.defdisp) {
        for(var i = 0; i < testProps.defdisp.length; i++) {
            let testGraphParent = makeGraphParent();

            addSkeletonGraph(testGraphParent, testProps.defdisp[i])

            if(testProps.defdisp[i] == "ping-graph") loadPingGraph(testGraphParent, testObject.TestID);
            else if (testProps.defdisp[i] == "fine-uptime") loadFineUptime(testGraphParent, testObject.TestID);

            testGraphGroup.appendChild(testGraphParent);
        }
    } else {
        let graphParent = makeGraphParent();
        loadFineUptime(graphParent, testObject.TestID);
        testGraphGroup.appendChild(graphParent);
    }
    
    

    return testGraphGroup;
}

function removeSkeletonGraph(parent) {
    let skeletons = parent.querySelectorAll(".graph-skeleton");

    for(var i = 0; i < skeletons.length; i++) {
        parent.removeChild(skeletons[i]);
    }
}

function addSkeletonGraph(parent, type) {
    let skeleton = document.createElement("div");

    skeleton.classList.add("graph-skeleton");
    skeleton.classList.add(type);

    parent.appendChild(skeleton);
}

function makeGraphParent() {
    let testGraphParent = document.createElement("div");
    testGraphParent.classList.add("graph-parent");
    return testGraphParent;
}

function makeGraphNodeBgColor(percent) {
    if(percent < 0) return "#ececec";
    return `hsl(${Math.floor(percent * 120)}, 50%, 60%)`; 
}

function testCodeCombination(num1,num2) {
    if(num1 == num2) return num2;

    let normalizedCombo = num1>num2 ? ""+num1+num2 : ""+num2+num1;
    
    let codeMap = {
        "10": 4,
        "21": 1,
        "30": 0,
        "31": 3,
        "32": 2,
        "40": 4,
        "41": 4,
        "42": 4,
        "43": 4,
    };

    return codeMap[normalizedCombo];
}

function testCodeClassName(code) {
    return testCodeDescription(code).replace(/\s/g,"-").toLowerCase();
}

function getCategoryName(encodedName) {
    return encodedName.replace(/ \([\w \d']+\)/, "").replace(/^\w+::/, "").replace(/{((\w+:.+([^\\],)?)+)}/, "").trim();
}

function testHasProps(encodedName) {
    return (/{((\w+:.+([^\\],)?)+)}/).test(encodedName);
}

function getTestProps(encodedName) {
    if(!testHasProps(encodedName)) return {};
    let props = (/{((\w+:.+([^\\],)?)+)}/).exec(encodedName)[2];

    let propData = {};
    let propList = props.split(",");

    for(var i = 0; i < propList.length; i++) {
        let propKeyValArray = propList[i].split(":");
        let propKey = propKeyValArray[0];
        let propValue = propKeyValArray[1];

        if(propData[propKey]) {
            propData[propKey].push(propValue);
        } else {
            propData[propKey] = [
                propValue
            ];
        }
        
    }

    return propData;
}

function getTestName(encodedName) {
    if(!(/ \(([\w '\d]+)\)/).test(encodedName)) return encodedName;
    return (/ \(([\w '\d]+)\)/).exec(encodedName)[1]
}

function testCodeDescription(code) {
    code = code + "";
    let descMap = {
        "0": "Outage",
        "1": "Operational",
        "2": "Not Online",
        "3": "In Maintenance",
        "4": "Partial Outage"
    }

    return descMap[code] || `Unknown Status ${code}`;
}

function getTestStatusCodeFromObj(thisTest) {
    if(thisTest.Name.startsWith("NO::") || thisTest.CheckRate == "86400") {
        return 2;
    } else if(thisTest.Name.startsWith("IM::")) {
        return 3;
    } else if(thisTest.Status == "Up") {
        return 1;
    } else if(thisTest.Status == "Down") {
        return 0;
    } else {
        return -1;
    }
}