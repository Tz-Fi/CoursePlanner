import React from "react";

import SemesterBox from "./semesterBox";
import { SEASON_NAMES, SEASON_NAMES_PRETTY, LOADING_ICON_TYPES } from "./util";

/*
 *  Table which contains all courses of current sequence
 *  Alternative to the SemesterList view. To be displayed for larger screens (>=sm)
 *
 *  Expects props:
 *
 *  courseSequenceObject - the json object which contains all necessary data for the sequence we want to display
 *  highlightedCoursePositions - the list of sequence positions whose course should get highlighted
 *
 *  onSelectCourse - see MainPage.loadCourseInfo
 *  onOrListSelection - see MainPage.setOrListCourseSelected
 *  onToggleWorkTerm - see MainPage.toggleWorkTerm
 *  onMoveCourse - see MainPage.moveCourse
 *  onChangeDragState - see MainPage.enableGarbage
 *
*/
export class SemesterTable extends React.Component {

    generateTableBody(){

        if(this.props.courseSequenceObject.isLoading){
            return <tr><td className="text-center" colSpan="4">{LOADING_ICON_TYPES.big}</td></tr>;
        }

        const yearList = this.props.courseSequenceObject.yearList;

        return yearList.map((year, yearIndex) =>
            <tr key={yearIndex}>
                <td className="text-center">{(yearIndex + 1)}</td>
                {SEASON_NAMES.map((season) =>
                    <td key={season}>
                        <SemesterBox yearIndex={yearIndex}
                                     season={season}
                                     semester={yearList[yearIndex][season]}
                                     highlightedCoursePositions={this.props.highlightedCoursePositions}
                                     onSelectCourse={this.props.onSelectCourse}
                                     onOrListSelection={this.props.onOrListSelection}
                                     onToggleWorkTerm={this.props.onToggleWorkTerm}
                                     onMoveCourse={this.props.onMoveCourse}
                                     onAddCourse={this.props.onAddCourse}
                                     onChangeDragState={this.props.onChangeDragState}/>
                    </td>
                )}
            </tr>
        );
    }

    generateTableHead(){
        return (
            <tr>
                <th className="text-center">Year</th>
                {SEASON_NAMES_PRETTY.map((season) =>
                    <th className="text-center" key={season}>{season}</th>
                )}
            </tr>
        );
    }

    render() {
        return (
            <table className="semesterTable table table table-bordered" >
                <thead>
                    {this.generateTableHead()}
                </thead>
                <tbody>
                    {this.generateTableBody()}
                </tbody>
            </table>
        );
    }
}