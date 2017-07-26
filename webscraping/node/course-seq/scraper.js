'use strict';

var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var assert = require('assert');
var courseCodeRegex = /\w{4}\s?\d{3}/;

const SEASON_NAMES = ["fall", "winter", "summer"];

// pull all html documents from sequenceUrls.json and write to appropriate .json files
var scrapeAllUrls = (function (){

    var outputDir = "./sequences/";
    var numStarted = 0, numCompleted = 0;

    fs.readFile("./sequenceUrls.json", function (err, data) {
        if (err) {
            console.error("ERROR reading sequenceUrls.json");
            process.exit(1);
        }

        var sequenceUrls = JSON.parse(data.toString());

        // do some logging each time a sequence is finished with
        var completionCallback = function(){
            numCompleted++;
            console.log(numCompleted + "/" + numStarted + " file writes completed");
            if(numCompleted == numStarted){
                console.log("All file writes have been completed.");
            }
        };

        for (var program in sequenceUrls) {
            var subList = sequenceUrls[program];
            var options = subList.Options;
            // in this case, sequenceVariant/optionType will be either September entry, January entry, or Coop
            if(options){
                for(var optionType in options){
                    var optionSubList = options[optionType];
                    for(var sequenceVariant in optionSubList){
                        var url = optionSubList[sequenceVariant];
                        var plainFileName = program + "-" + optionType + "-" + sequenceVariant + ".json";
                        numStarted++;
                        scrapeEncsSequenceUrl(url, outputDir, plainFileName, completionCallback);
                    }
                }
            } else {
                for(var sequenceVariant in subList){
                    var url = subList[sequenceVariant];
                    var plainFileName =  program + "-" + sequenceVariant + ".json";
                    numStarted++;
                    scrapeEncsSequenceUrl(url, outputDir, plainFileName, completionCallback);
                }
            }
        }
    });
})();

// pull html document from url and write to appropriate .json files
function scrapeEncsSequenceUrl(url, outPath, plainFileName, onComplete){

    request(url, function(error, response, html){
        if(!error){
            var $ = cheerio.load(html);

            var semesterList = [];
            var courseList = [];
            var currentSeason = "";
            var hasStartedScraping = false;
            var minTotalCredits = $(".section.title .section-header").text().match(/\S*\d+\S*/)[0];

            $(".concordia-table.table-condensed tbody > tr").each(function(i, el){
                var $row = $(this);

                if(i === 0){
                    var seasonText = $(this).children().html().toLowerCase();
                    currentSeason = parseSeason(seasonText);
                }

                if($row.children().length === 3){
                    $row.each(function(i, el){
                        var $rowCell = $(this);
                        var containsBoldText = $rowCell.children()[0].name === "th";
                        if(!containsBoldText){
                            var code = "", name = "", isElective = "false", electiveType = "", credits = "", foundACourse = false;
                            var firstCellText = $rowCell.find("p").text() || $rowCell.find("td").text();
                            firstCellText = firstCellText.toLowerCase().trim();
                            var pattern = new RegExp(/\bor\b/);
                            var courseCodeValue = $($rowCell.children()[0]).text().replace(/\r?\n|\r/g, " ").trim().toLowerCase();

                            if(firstCellText.indexOf("work term") >= 0){
                                semesterList.push({
                                    "season": currentSeason,
                                    "courseList": courseList,
                                    "isWorkTerm": "true"
                                });
                            } else if(pattern.test(courseCodeValue)){
                                var orList = courseCodeValue.split(/\bor\b/);
                                var orCourseList = [];
                                orList.forEach(function(courseCode){
                                    var isElec = "false", elecType = "";
                                    if(firstCellText.indexOf("basic science") >= 0){
                                        courseCode = "";
                                        isElec = "true";
                                        elecType = "Science";
                                    } else if(courseCode.indexOf("general") >= 0){
                                        courseCode = "";
                                        isElec = "true";
                                        elecType = "General";
                                    } else if(courseCode.indexOf("elective") >= 0){
                                        courseCode = "";
                                        isElec = "true";
                                        elecType = "Program";
                                    } else {
                                        courseCode = extractCourseCode(courseCode);
                                    }
                                    courseCode = addMiddleSpaceIfNeeded(courseCode);
                                    orCourseList.push({
                                        "code": courseCode.trim().toUpperCase(),
                                        "isElective": isElec.trim(),
                                        "electiveType": elecType.trim()
                                    });
                                });
                                courseList.push(orCourseList);
                            } else if(firstCellText.indexOf("basic science") >= 0){
                                isElective = "true";
                                electiveType = "Science";
                                foundACourse = true;
                            } else if(firstCellText.indexOf("general") >= 0){
                                isElective = "true";
                                electiveType = "General";
                                foundACourse = true;
                            } else if(firstCellText.indexOf("elective") >= 0){
                                isElective = "true";
                                electiveType = "Program";
                                foundACourse = true;
                            } else {
                                // add a course to the course list
                                code = extractCourseCode($($rowCell.children()[0]).text());
                                foundACourse = true;
                            }
                            if(foundACourse && (code.trim().length > 0) || electiveType.trim().length > 0){
                                code = addMiddleSpaceIfNeeded(code);
                                courseList.push({
                                    "code": code.trim().toUpperCase(),
                                    "isElective": isElective.trim(),
                                    "electiveType": electiveType.trim()
                                });
                            }
                        }
                    });
                } else if(/work term [i]+/g.test($row.children().text().toLowerCase())){
                    semesterList.push({
                        "season": currentSeason,
                        "courseList": courseList,
                        "isWorkTerm": "true"
                    });
                }else if($row.children().text().toLowerCase().indexOf("year") >= 0){
                    if(hasStartedScraping){
                        if(courseList.length > 0){
                            semesterList.push({
                                "season": currentSeason,
                                "courseList": courseList,
                                "isWorkTerm": "false"
                            });
                        }
                        courseList = [];
                        currentSeason = parseSeason($row.children().text().toLowerCase());
                    }
                    hasStartedScraping = true;
                }
            });

            // add residual semester if there is one
            if(courseList.length > 0){
                semesterList.push({
                    "season": currentSeason,
                    "courseList": courseList,
                    "isWorkTerm": "false"
                });
            }

            var yearList = toYearList(semesterList);

            var sequenceObject = {
                "sourceUrl": url,
                "minTotalCredits" : minTotalCredits,
                "yearList" : yearList
            };

            console.log("Finished scraping from url: " + url);

            fs.writeFile(outPath + plainFileName, JSON.stringify(sequenceObject, null, 4), function(err){
                if(err){
                    console.error("ERROR writing to a file: " + plainFileName);
                    process.exit(1);
                } else {
                    console.log("Done writing file: " + plainFileName);
                    onComplete && onComplete();
                }
            });

        }
    });
}

// converts a list of semesters into a list of years, ensuring that each year has a fall, winter and summer semester object
function toYearList(semesterList){

    var yearList = [];

    const noCourseSemester = {
        "courseList": [],
        "isWorkTerm": "false",
    };

    // first, fill in missing semesters
    var filledSemesterList = fillMissingSemesters(semesterList);

    // second, form year objects and add them to year list
    for(let year = 1; year <= (Math.ceil(filledSemesterList.length/3)); year++){
        let yearObject = {};
        SEASON_NAMES.forEach((season, seasonIndex) => {
            let currentSemester = filledSemesterList[((year-1)*3)+seasonIndex] || noCourseSemester;

            // remove season property as it has become redundant information
            delete currentSemester.season;

            yearObject[season] = currentSemester;
        });
        yearList.push(yearObject);
    }

    return yearList;
}

// Take an array of semester objects and add in any missing semesters
function fillMissingSemesters(semesterList){
    for(var i = 0; i < semesterList.length; i++){

        let expectedSeason = SEASON_NAMES[i%3];

        if(!(semesterList[i].season === expectedSeason)){
            semesterList.splice(i, 0, {
                "courseList" : [],
                "isWorkTerm" : "false"
            });
        }

    }
    return semesterList;
}

function addMiddleSpaceIfNeeded(courseCode){
    var pattern = new RegExp(/^\w{4}\d{3}$/);
    var res = pattern.test(courseCode.trim());
    if(res){
        // add space where it needs to go
        return courseCode.substr(0, 4) + " " + courseCode.substr(4);
    } else {
        return courseCode;
    }
}

function extractCourseCode(courseCodeStr){
    var test = courseCodeStr.match(courseCodeRegex);
    return (test) ? test[0] : "";
}

function parseSeason(season){
    if(season.indexOf("fall") >= 0){
        return "fall";
    } else if(season.indexOf("winter") >= 0){
        return "winter";
    } else if(season.indexOf("summer") >= 0){
        return "summer";
    }
    return undefined;
}

module.exports.scrapeSingleUrl = function(url, onComplete){
    scrapeEncsSequenceUrl(url, "./", "debug.json", onComplete);
};