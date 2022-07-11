import React from 'react';
import withRouter from '../components/WithRouter'
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Row, Col, Table, OverlayTrigger,
  Tooltip, Dropdown, Button, Accordion, ButtonToolbar
} from 'react-bootstrap';

import Collapsible from 'react-collapsible';
import { ContextMenu, MenuItem, ContextMenuTrigger } from "react-contextmenu";

import { MdRemove, MdFlare, Md360 } from "react-icons/md";
import { BsSquare, BsCheck2Square, BsDashSquare, BsPlus, BsDash} from "react-icons/bs";

import { CSSGrid, layout, SpringGrid } from 'react-stonecutter';

import classNames from 'classnames';

import { QUEUE_STOPPED, QUEUE_RUNNING, isCollected, hasLimsData } from '../constants';

import { toggleMovableAction,
  selectSamplesAction,
  sendSetSampleOrderAction } from '../actions/sampleGrid';

import { deleteTask, addSampleAndMount } from '../actions/queue';

import { unloadSample } from '../actions/sampleChanger';

import { showTaskForm } from '../actions/taskForm';

import { showDialog } from '../actions/general';


import { SampleGridItem,
  SAMPLE_ITEM_WIDTH,
  SAMPLE_ITEM_HEIGHT,
  SAMPLE_ITEM_SPACE } from '../components/SampleGrid/NewSampleGridItem';

import { TaskItem } from '../components/SampleGrid/NewTaskItem';

import tempIMG from '../img/flexHCD.png';

import '../components/SampleGrid/SampleGrid.css';


class NewSampleGridContainer extends React.Component {

  constructor(props) {
    super(props);
    this.shouldComponentUpdate = this.shouldComponentUpdate.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);

    this.filter = this.filter.bind(this);
    this.mutualExclusiveFilterOption = this.mutualExclusiveFilterOption.bind(this);
    this.sampleGridItemsSelectedHandler = this.sampleGridItemsSelectedHandler.bind(this);
    this.inQueueSampleID = this.inQueueSampleID.bind(this);

    this.pickAllPuckItemsOnClick = this.pickAllPuckItemsOnClick.bind(this);
    this.pickAllCellItemsOnClick = this.pickAllCellItemsOnClick.bind(this);

    this.currentSample = this.currentSample.bind(this);
    this.getSampleTable = this.getSampleTable.bind(this);
    this.getSampleItems = this.getSampleItems.bind(this);

    this.getSamplesList = this.getSamplesList.bind(this);

    this.selectItemUnderCursor = this.selectItemUnderCursor.bind(this);
    this.sampleItemPickButtonOnClickHandler = this.sampleItemPickButtonOnClickHandler.bind(this);
    this.sampleItemMoveButtonOnClickHandler = this.sampleItemMoveButtonOnClickHandler.bind(this);
    this.sampleItemOnMoveHandler = this.sampleItemOnMoveHandler.bind(this);
    this.sampleItemIsSelected = this.sampleItemIsSelected.bind(this);
    this.sampleItemCanMove = this.sampleItemCanMove.bind(this);

    this.taskItemDeleteButtonOnClickHandler = this.taskItemDeleteButtonOnClickHandler.bind(this);
    this.taskItemOnClickHandler = this.taskItemOnClickHandler.bind(this);

    this.showRubberBand = false;
    this.sampleItems = [];
    this.workflowMenuOptions = this.workflowMenuOptions.bind(this);
    this.mountAndCollect = this.mountAndCollect.bind(this);
    this.unmount = this.unmount.bind(this);

    this.currentCtxMenu = 'contextMenu';
  }


  componentDidMount() {
    // document.addEventListener('contextmenu', this.onContextMenu, false);
    document.addEventListener('keydown', this.onKeyDown, false);
    document.addEventListener('click', this.onClick, false);
  }


  shouldComponentUpdate(nextProps) {
    return this.props.queue.queue !== nextProps.queue.queue ||
           Object.keys(this.props.sampleList) !== Object.keys(nextProps.sampleList) ||
           this.props.order !== nextProps.order;
  }


  componentWillUnmount() {
    // document.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('click', this.onClick);
  }


  /**
   * Handles multiple item selection on mouseDown, initializes the 'rubberband'
   * that outlines the selected area.
   *
   * @param {MouseEvent} e
   */
  onMouseDown(e) {
    const selectionRubberBand = document.querySelector('#selectionRubberBand');
    selectionRubberBand.style.top = `${e.pageY}px`;
    selectionRubberBand.style.left = `${e.pageX}px`;
    selectionRubberBand.style.width = '0px';
    selectionRubberBand.style.height = '0px';
    this.showRubberBand = true;

    e.preventDefault();
    e.stopPropagation();
  }


  /**
   * Updates the rubberband if the mutiple selection was initiated (mouseDown
   * followed by mouseMove)
   *
   * @param {MouseEvent} e
   */
  onMouseMove(e) {
    if (this.showRubberBand) {
      const selectionRubberBand = document.querySelector('#selectionRubberBand');
      document.querySelector('#selectionRubberBand').style.display = 'block';
      selectionRubberBand.style.width = `${e.pageX - selectionRubberBand.offsetLeft}px`;
      selectionRubberBand.style.height = `${e.pageY - selectionRubberBand.offsetTop}px`;
    }

    e.preventDefault();
    e.stopPropagation();
  }


  /**
   * Selectes the items under the slected area and hides the rubberband
   * @param {MouseEvent} e
   */
  onMouseUp(e) {
    const selectionRubberBand = document.querySelector('#selectionRubberBand');

    const selected = this.sampleItems.filter((sampleItem) => {
      const sampleElement = document.getElementById(sampleItem.key);
      return this.checkForOverlap(selectionRubberBand, sampleElement);
    }).map((sampleItem) => sampleItem.key);

    selectionRubberBand.style.display = 'none';
    this.showRubberBand = false;

    // If several samples selected call the handler, otherwise rely on
    // onClick handler to handle the click
    if (selected.length > 1) {
      this.sampleGridItemsSelectedHandler(e, selected);
    } else {
      this.selectItemUnderCursor(e);
    }
  }


  /**
   * Moves SampleItems on arrow key press
   *
   * @param {MouseEvent} e
   */
  onKeyDown(e) {
    const sampleID = Object.keys(this.props.moving)[0];

    switch (e.key) {
    case 'ArrowRight': {
      this.sampleItemOnMoveHandler(e, sampleID, 'RIGHT');
    
    break;
    }
    case 'ArrowLeft': {
      this.sampleItemOnMoveHandler(e, sampleID, 'LEFT');
    
    break;
    }
    case 'ArrowDown': {
      this.sampleItemOnMoveHandler(e, sampleID, 'DOWN');
    
    break;
    }
    case 'ArrowUp': {
      this.sampleItemOnMoveHandler(e, sampleID, 'UP');
    
    break;
    }
    case 'Escape': {
      this.props.selectSamples(Object.keys(this.props.sampleList), false);
    break;
    }
    // No default
    }
  }

  /**
  * Selects clicked item and shows context menu
  *
  * @param {MouseEvent} e
  */
  onContextMenu(e) {
    let res = true;

    this.selectItemUnderCursor(e);

    // this.currentCtxMenu = 'contextMenu';
    // let contextMenuToHide = 'contextMenuMounted';

    // if (Object.keys(this.props.selected)[0] === this.props.sampleChanger.loadedSample.address) {
    //   this.currentCtxMenu = 'contextMenuMounted';
    //   contextMenuToHide = 'contextMenu';
    // }

    // const menuEl = document.getElementById(this.currentCtxMenu);

    // if (this.props.queue.queueStatus === QUEUE_RUNNING) {
    //   menuEl.style.display = 'none';
    // } else if (e.target.className.includes('samples-grid-item') && e.button === 2) {
    //   menuEl.style.top = `${e.pageY}px`;
    //   menuEl.style.left = `${e.pageX}px`;
    //   menuEl.style.display = 'block';
    //   document.getElementById(contextMenuToHide).style.display = 'none';
    //   res = false;
    // } else {
    //   menuEl.style.display = 'none';
    // }

    return res;
  }

  /**
   * Select Items for collect 
  * Add All items in a puck to queue
  */
     pickAllPuckItemsOnClick(cell, puck, pickSample) {
      const sampleItemToAdd = []
      // debugger;
      // this.props.inQueueDeleteElseAddSamples([sampleID]);
      this.props.order.forEach(key => {
        const sample = this.props.sampleList[key];
        if (this.filter(key)) {
          if (sample.cell_no == cell && sample.puck_no == puck ) {
            // if (this.props.inQueue(sample.sampleID) && sample.checked) {
              sampleItemToAdd.push(sample.sampleID)
            // }
         }
        }
      });

      if(pickSample) {
        this.props.addSamplesToQueue(sampleItemToAdd)
      }
  
      // this.props.inQueueDeleteElseAddSamples(sampleItemToAdd)
  
    }
  
    /**
    * Select All items in a Cell
    */
    pickAllCellItemsOnClick (cell) {
  
      const sampleItemToAdd = []
      debugger;
      // this.props.inQueueDeleteElseAddSamples([sampleID]);
      this.props.order.forEach(key => {
        const sample = this.props.sampleList[key];
        if (this.filter(key)) {
          if (sample.cell_no == cell) {
            // if (this.props.inQueue(sample.sampleID) && sample.checked) {
              sampleItemToAdd.push(sample.sampleID)
            // }
         }
        }
      });
  
      this.props.inQueueDeleteElseAddSamples(sampleItemToAdd)
  
    }


  filterListCell(cell) {
    let allCellSample = [];
    let allCellSampleCheck = [];

    this.props.order.forEach(key => {
      const sample = this.props.sampleList[key];
      if (this.filter(key)) {
        if (sample.cell_no == cell) {
          allCellSample.push(sample.sampleID);
          if (this.props.inQueue(sample.sampleID) && sample.checked) {
            allCellSampleCheck.push(sample.sampleID)
          }
       }
      }
    });
    return [allCellSample, allCellSampleCheck, cell, null ]
  }

  filterListPuck(cell, puck) {
    let allPuckSample = [];
    let allPuckSampleCheck = [];

    this.props.order.forEach(key => {
      const sample = this.props.sampleList[key];
      if (this.filter(key)) {
        if (sample.cell_no == cell && sample.puck_no == puck ) {
          allPuckSample.push(sample.sampleID);
          if (this.props.inQueue(sample.sampleID) && sample.checked) {
            allPuckSampleCheck.push(sample.sampleID)
          }
       }
      }
    });
    return [allPuckSample, allPuckSampleCheck, cell, puck]
  }

  itemsControls(filterList) {
    let icon = <BsSquare size='0.9em'/>;
    let allPuckSample = filterList[0];
    let allPuckSampleCheck = filterList[1];
    let pickSample = true;
    const cell = filterList[2]
    const puck = filterList[3]

    if (allPuckSample.length === allPuckSampleCheck.length) {
      icon = <BsCheck2Square size='0.9em'/>;
      pickSample = false;
    }
    else if(allPuckSample.length !== allPuckSampleCheck.length && allPuckSampleCheck.length > 0) {
      icon = <BsDashSquare size='0.9em'/>;
      pickSample = false;
    }

    let onClickFunc = this.pickAllPuckItemsOnClick;

    if (puck === null) {
      onClickFunc = this.pickAllCellItemsOnClick;
    }

    return (
      <OverlayTrigger
        placement="auto"
        overlay={(
        <Tooltip id="pick-sample">{pickSample? 'Pick samples/ Add to Queue' : 'Unpick samples / Remove from Queue'}</Tooltip>
        )}
      >
        <Button
          variant="content"
          disabled={this.props.current && this.props.picked}
          className="pick-puck-checkbox-button"
          onClick={() => onClickFunc(cell, puck, pickSample)}
          // onMouseUp={this.pickButtonMuseUp}
          // onMouseDown={this.pickButtonMouseDown}
        >
          <i>{icon}</i>
        </Button>
      </OverlayTrigger>
    );
  }


  getSampleTable(props) {
    const sc = props.sampleChanger.contents;
    let tableCell = [];

    if (sc.children && props.order.length > 0) {
      tableCell = Object.values(sc.children).map((cell) => {
        if (this.props.filterOptions.puckFilter.toLowerCase() === cell.name
          || this.props.filterOptions.puckFilter.toLowerCase() === ''){
          return (
            <Col key={cell.name} sm={6} className="mb-2">
              <div className='sample-items-collapsible-header-actions'>
                  {this.itemsControls(this.filterListCell(cell.name))}
              </div>
              <Collapsible transitionTime={400} className='sample-items-collapsible'
                open
                trigger={<div className='sample-items-collapsible-header'> Cell {cell.name}</div>}
              >
                <Table bordered responsive size="sm" className='sample-items-table'>
                  <thead>
                    <tr>
                      <th className='sample-items-table-row-header-th'>
                        <span>Puck 1 {this.itemsControls(this.filterListPuck(cell.name, 1))}</span>
                      </th>
                      <th className='sample-items-table-row-header-th'>
                        <span>Puck 2 {this.itemsControls(this.filterListPuck(cell.name, 2))}</span>
                      </th>
                      <th className='sample-items-table-row-header-th'>
                        <span>Puck 3 {this.itemsControls(this.filterListPuck(cell.name, 3))}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className='p-1'>{this.getSampleItems(props, cell.name, 1)}</td>
                      <td>{this.getSampleItems(props, cell.name, 2)}</td>
                      <td>{this.getSampleItems(props, cell.name, 3)}</td>
                    </tr>
                  </tbody>
                </Table>
              </Collapsible>
            </Col>
            );
          }
          else {return null}
      });
    }

    return tableCell;
  }

  /**
   * Build a list of SampleItems and for each SampleItem a list of TaskItems
   *
   * @property {Object} sampleList
   * @property {array} order
   * @property {array} queue
   * @property {object} moving
   * @property {object} selected
   *
   * return {array} array of SampleItems
   */
  getSampleItems(props, cell, puck) {
    const sampleItemList = [];
    const orderedList = [];

    props.order.forEach(key => {
      if (props.queue.queue.includes(key) && props.sampleList[key].checked) {
        orderedList.push(key);
      }
    });

    props.order.forEach(key => {
      const sample = props.sampleList[key];
      const picked= props.inQueue(sample.sampleID) && sample.checked

      const classes = classNames('new-samples-grid-li',
      { 'new-samples-grid-item-selected': props.selected[sample.sampleID] && !props.moving[key],
        // 'new-samples-grid-item-moving': this.props.moving,
        'new-samples-grid-item-to-be-collected': picked,
        'new-samples-grid-item-collected': isCollected(sample) });

      const liClass = props.moving[key] ? 'new-samples-grid-li-mv' : 'new-samples-grid-item-to-be-collected ';


      if (this.filter(key)) {
        if (sample.cell_no == cell && sample.puck_no == puck ) {
          const contextMenuID = this.props.sampleChanger.loadedSample.address == sample.sampleID ?
          `new-samples-grid-context-menu-mounted-${key}` :`new-samples-grid-context-menu-${key}`;
          sampleItemList.push(
              <li className={classes} key={key}>
                <ContextMenuTrigger id={`new-samples-grid-context-menu-${key}`}>
                  <Collapsible transitionTime={400} className='new-samples-grid-item-to-be-collected' open trigger={
                      <SampleGridItem
                        key={key}
                        itemKey={key}
                        pickButtonOnClickHandler={this.sampleItemPickButtonOnClickHandler}
                        moveButtonOnClickHandler={this.sampleItemMoveButtonOnClickHandler}
                        onMoveHandler={this.sampleItemOnMoveHandler}
                        allowedDirections={this.sampleItemCanMove(key)}
                        sampleData={sample}
                        queueOrder={orderedList.indexOf(key) + 1}
                        selected={props.selected[sample.sampleID]}
                        current={this.currentSample(sample.sampleID)}
                        picked={picked}
                        moving={props.moving[key]}
                    />
                  }>
                    <Row className="new-samples-grid-item-tasks">
                      {sample.tasks.map((taskData, i) => (
                        <TaskItem
                          key={i}
                          taskItemOnClick={this.taskItemOnClickHandler}
                          showDialog={this.props.showDialog}
                          deleteButtonOnClick={this.taskItemDeleteButtonOnClickHandler}
                          taskData={taskData}
                          taskIndex={i}
                        />))
                      }
                    </Row>
                  </Collapsible>
                </ContextMenuTrigger>
                <ContextMenu id={`new-samples-grid-context-menu-${key}`}>
                  {this.sampleContextMenu()}
                  {this.taskContextMenuItems()}
                </ContextMenu>
                <ContextMenu id={`new-samples-grid-context-menu-mounted-${key}`}>
                  {this.sampleContextMenuMounted()}
                  {this.taskContextMenuItems()}
                </ContextMenu>
              </li>  
            );
          }
        }
    });

    return sampleItemList;
  }


  getSamplesList(props) {
    const sampleItemList = [];

    props.order.forEach(key => {
      const sample = props.sampleList[key];
      if (this.filter(key)) {
         sampleItemList.push(<li key={key}>{sample.sampleID}</li>);
        }
    });

    return sampleItemList;
  }

  currentSample(sampleID) {
    let current = false;

    if (this.props.queue.current.sampleID) {
      current = this.props.queue.current.sampleID === sampleID;
    } else if (this.props.sampleChanger.loadedSample.address) {
      current = this.props.sampleChanger.loadedSample.address === sampleID;
    }

    return current;
  }

  /**
   * Selects the SampleItem currently under the mouse cursor
   *
   * @param {MouseEvent} e
   */
  selectItemUnderCursor(e) {
    // Handling single item selection, create a syntheticElement to use for the
    // mouse cursor when doing the overlap detection, reusing the same
    // mechanism as for mutiple selection
    const syntheticElement = { getBoundingClientRect: () => {
      return { top: e.clientY, left: e.clientX,
        bottom: e.clientY + 1, right: e.clientX + 1,
        width: 1, height: 1 };
    } };

    const selected = this.sampleItems.filter((sampleItem) => {
      const sampleElement = document.getElementById(sampleItem.key);
      return this.checkForOverlap(syntheticElement, sampleElement);
    }).map((sampleItem) => sampleItem.key);

    if (selected.length > 0) { this.sampleGridItemsSelectedHandler(e, selected); }
  }


  /**
   * Calculates the grid dimension
   *
   * return {array} array on the format [NumRowsCol1, NumRowsCol2, ... NumRowsColN]
   */
  gridDimension() {
    const colArray = [];
    const numItems = Object.keys(this.props.order).length;
    const numFullCols = Math.floor(this.props.gridWidth[0] / SAMPLE_ITEM_WIDTH);
    const numFullRows = Math.floor(numItems / numFullCols);
    const itemsOnLastRow = numItems - (numFullRows * numFullCols);

    for (let i = 0; i < numFullRows; i++) {
      colArray[i] = numFullCols;
    }

    if (itemsOnLastRow > 0) {
      colArray[numFullRows] = itemsOnLastRow;
    }

    return colArray;
  }


  /**
   * Helper function for filter that takes a sample object instead of sampleID
   *
   * @param {object} sample
   * return {boolean} true if sample is in queue otherwise false
   */
  inQueueSampleID(sample) {
    return this.props.inQueue(sample.sampleID);
  }


  /**
   * Performs filtering on a sample with two options that are mutually exclusive
   * Includes sample according to provided options o1 and o2, always includes the
   * sample if both options are either true or false simultaneously (ignoring the
   * options o1 and o2)
   *
   * @property {Object} filterOptions
   * @param {Object} sample
   * @param {string} o1 - option name 1
   * @param {string} o2 - option name 2
   * @param {function} fun - function that tests for inclusion
   *
   * return {boolean} true if item is to be included otherwise false
   */
  mutualExclusiveFilterOption(sample, o1, o2, testFun) {
    let includeItem = false;

    // First case is included for clarity since the two options
    // cancel each other out. Dont do anything same as both false. Otherwise
    // apply filter.

    if (this.props.filterOptions[o1] && this.props.filterOptions[o2]) {
      includeItem = true;
    } else if (!this.props.filterOptions[o1] && !this.props.filterOptions[o2]) {
      includeItem = true;
    } else if (this.props.filterOptions[o1]) {
      includeItem = testFun(sample);
    } else if (this.props.filterOptions[o2]) {
      includeItem = !testFun(sample);
    }

    return includeItem;
  }


  /**
   * Filter function for SampleItems
   *
   * @property {Object} sampleList
   * @property {Object} filterOptions
   *
   * @param {string} key - sampleID
   *
   * return {boolean} true if item is to be excluded otherwise false
   */
  filter(key) {
    const sample = this.props.sampleList[key];
    let fi = false;

    if (sample) {
      const sampleFilter = `${sample.sampleName} ${sample.proteinAcronym}`.toLowerCase();
      const locationFilter = `${sample.location}`;

      fi = sampleFilter.includes(this.props.filterOptions.text.toLowerCase());

      fi &= locationFilter.startsWith(this.props.filterOptions.puckFilter.toLowerCase());
      fi &= this.mutualExclusiveFilterOption(sample, 'inQueue', 'notInQueue', this.inQueueSampleID);
      fi &= this.mutualExclusiveFilterOption(sample, 'collected', 'notCollected', isCollected);
      fi &= this.mutualExclusiveFilterOption(sample, 'limsSamples', '', hasLimsData);
    }

    return fi;
  }


  /**
   * Handles selection of SampleItems
   *
   * @property {Object} selected
   *
   * @param {MouseEvent} e
   * @param {array} sampleIDlist - array of sampleIDs to select
   *
   * return {boolean} true if item is to be included otherwise false
   */
  sampleGridItemsSelectedHandler(e, sampleIDList) {
    const alreadySelected = sampleIDList.length === 1 && this.sampleItemIsSelected(sampleIDList[0]);
    let samplesToSelect = sampleIDList;

    // We dont want to do anything here if sample is already selected and
    // the right button was clicked. This allows for the context menu to be
    // used on several samples at once. Otherwise just do the select magic.
    if (!(alreadySelected && e.button === 2)) {
      // CTRL key is pressed just modify the current selection, remove already
      // selected and add new ones.
      if (e.ctrlKey) {
        const intersection = new Set(sampleIDList.filter((sampleID) => (
          this.sampleItemIsSelected(sampleID)
        )));

        const union = Object.keys(this.props.selected).concat(sampleIDList);
        samplesToSelect = union.filter((sampleID) => !intersection.has(sampleID));
      }

      this.props.selectSamples(samplesToSelect);
    }
  }


  /**
   * Handles sample movement in grid (change of order)
   *
   * @property {Object} order
   *
   * @param {MouseEvent} e
   * @param {array} sampleID - sample to move
   * @param {string} dir - direction to move one of [RIGHT, LEFT, DOWN, UP]
   *
   * return {boolean} true if item is to be included otherwise false
   */
  sampleItemOnMoveHandler(e, sampleID, dir) {
    e.preventDefault();
    e.stopPropagation();

    if (!sampleID || !this.props.moving[sampleID]) {
      return;
    }

    const numCols = this.gridDimension()[0];
    const sourcePos = this.props.order.indexOf(sampleID);
    let targetPos = sourcePos;
    const [canMoveUp, canMoveDown, canMoveLeft, canMoveRight] = this.sampleItemCanMove(sampleID);

    if (dir === 'RIGHT' && canMoveRight) {
      targetPos += 1;
    } else if (dir === 'LEFT' && canMoveLeft) {
      targetPos -= 1;
    } else if (dir === 'DOWN' && canMoveDown) {
      targetPos += numCols;
    } else if (dir === 'UP' && canMoveUp) {
      targetPos -= numCols;
    } else {
      return;
    }

    const newSampleOrder = [...this.props.order];
    newSampleOrder.splice(targetPos, 0, newSampleOrder.splice(sourcePos, 1)[0]);
    this.props.sendSetSampleOrderAction(newSampleOrder);
  }


  /**
   * Handles click on move sample button (when the user initiates move)
   *
   * @param {MouseEvent} e
   * @param {string} sampleID - sample to move
   */
  sampleItemMoveButtonOnClickHandler(e, sampleID) {
    e.stopPropagation();
    this.props.toggleMovableAction(sampleID);
  }


  /**
   * Handles click on sample item pick 'checkbox', adds sample to queue if its
   * not in the queue or removes it from the queue if it was already in.
   *
   * @param {MouseEvent} e
   * @param {string} sampleID - sampleID to toggle (remove from or add to queue)
   */
  sampleItemPickButtonOnClickHandler(e, sampleID) {
    e.stopPropagation();

    // Is sample already in the set of selected samples, add all those samples
    // to queue
    if (this.sampleItemIsSelected(sampleID)) {
      this.props.inQueueDeleteElseAddSamples(Object.keys(this.props.selected));
    } else {
      // The sample is not in the set of selected samples (or no samples are
      // selected), select only sample with sampleID and add it queue
      this.props.selectSamples([sampleID]);
      this.props.inQueueDeleteElseAddSamples([sampleID]);
    }
  }


  /**
   * Returns true if sample is selected
   *
   * @param {string} sampleID
   * @return {boolean} true if sample is selected else false
   */
  sampleItemIsSelected(sampleID) {
    return Object.keys(this.props.selected).includes(sampleID);
  }


  /**
   * Returns an array with booleans that tell if the SampleItem with
   * the given sampleID can move in a certain direction
   *
   * @param {key} sampleID
   * @return {array} - [canMoveUp, canMoveDown, canMoveLeft, canMoveRight]
   */
  sampleItemCanMove(key) {
    let [up, down, left, right] = [true, true, true, true];
    const itemPos = this.itemGridPosition(key);

    if (Object.keys(this.props.selected).map(_key => this.props.selected[_key]).length === 1) {
      if (itemPos.col === 0) {
        left = false;
      }

      if (itemPos.row === 0) {
        up = false;
      }

      if (itemPos.row === (itemPos.gridDimension.length - 1)) {
        down = false;
      }

      if (itemPos.col > (itemPos.gridDimension[itemPos.row + 1] - 1)) {
        down = false;
      }

      if (itemPos.col === (itemPos.gridDimension[itemPos.row] - 1)) {
        right = false;
      }
    } else {
      [up, down, left, right] = [false, false, false, false];
    }

    return [up, down, left, right];
  }

  /**
   * Returns the grid position of SampleItem
   *
   * @param {string} key - sampleID of the sample
   * @return {object} {row: n, col: m, gridDimension: [NumRowsCol1, ... NumRowsColN]}
   */
  itemGridPosition(key) {
    const gridDim = this.gridDimension();
    const numCols = gridDim[0];
    const pos = this.props.order.indexOf(key);

    const rowPos = Math.floor(pos / numCols);
    const colPos = pos - (rowPos * numCols);

    return { row: rowPos, col: colPos, gridDimension: gridDim };
  }


  /**
   * Handels clicks on TaskItem
   *
   * @param {MouseEvent} e
   * @param {object} task - clicked task
   */
  taskItemOnClickHandler(e, task) {
    e.stopPropagation();
    this.props.showTaskParametersForm(task.type, task.sampleID, task);
  }


  /**
   * Handels clicks on TaskItem delete button
   *
   * @param {MouseEvent} e
   * @param {string} sampleID - sampleID of the sample the tasks belong to
   * @param {number} taskIndex - index of task
   */
  taskItemDeleteButtonOnClickHandler(e, sampleID, taskIndex) {
    e.stopPropagation();

    if (this.props.queue.queueStatus === QUEUE_STOPPED) {
      this.props.deleteTask(sampleID, taskIndex);
    }
  }


  /**
   * Checks if the two DOMElements el1 and el2 overlap
   *
   * @param {DOMElement} el1
   * @param {DOMElement} el2
   * @return {boolean}
   */
  checkForOverlap(el1, el2) {
    let result = false;
    const bounds1 = el1.getBoundingClientRect();
    const bounds2 = el2.getBoundingClientRect();

    const firstIstLeftmost = (bounds1.left <= bounds2.left);
    const leftmost = firstIstLeftmost ? bounds1 : bounds2;
    const rightmost = firstIstLeftmost ? bounds2 : bounds1;

    // change to >= if border overlap should count
    if (leftmost.right > rightmost.left) {
      const firstIsTopmost = (bounds1.top <= bounds2.top);
      const topmost = firstIsTopmost ? bounds1 : bounds2;
      const bottommost = firstIsTopmost ? bounds2 : bounds1;

      // change to >= if border overlap should count
      result = topmost.bottom > bottommost.top;
    }

    return result;
  }


  /**
   * Returns menu options for workflow tasks
   *
   * @property {Object} workflows
   *
   * return {array} Array of <Dropdown.Item>
   */
  workflowMenuOptions() {
    const workflowTasks = { point: [], line: [], grid: [], samplegrid: [], none: [] };

    Object.values(this.props.workflows).forEach((wf) => {
      if (wf.requires.includes('point')) {
        workflowTasks.point.push({ text: wf.wfname,
          action: () => this.props.showWorkflowForm(wf),
          key: `wf-${wf.wfname}` });
      } else if (wf.requires.includes('line')) {
        workflowTasks.line.push({ text: wf.wfname,
          action: () => this.props.showWorkflowForm(wf),
          key: `wf-${wf.wfname}` });
      } else if (wf.requires.includes('grid')) {
        workflowTasks.grid.push({ text: wf.wfname,
          action: () => this.props.showWorkflowForm(wf),
          key: `wf-${wf.wfname}` });
      } else if (wf.requires.includes('samplegrid')) {
        workflowTasks.samplegrid.push({ text: wf.wfname,
          action: () => this.props.showWorkflowForm(wf),
          key: `wf-${wf.wfname}` });
      } else {
        workflowTasks.none.push({ text: wf.wfname,
          action: () => this.props.showWorkflowForm(wf),
          key: `wf-${wf.wfname}` });
      }
    });

    return workflowTasks.samplegrid.map((wf) => (
      <MenuItem eventKey={wf.key} onClick={wf.action} key={wf.key}>
        {wf.text}
      </MenuItem>
    ));
  }


  mountAndCollect() {
    let sampleData = null;

    // If several samples selected mount the first one and add the others to the queue
    this.props.order.some((sampleID) => {
      if (this.props.selected[sampleID]) {
        sampleData = this.props.sampleList[sampleID];
      }
      return this.props.selected[sampleID] === true;
    });

    if (sampleData) {
      this.props.addSampleAndMount(sampleData);
      this.props.router.navigate('/datacollection' , { replace: true });
    }
  }


  unmount() {
    this.props.unloadSample();
  }

  taskContextMenuItems() {
    return (
      <>
        <Dropdown.Divider />
        <MenuItem header> <span> <i className="fas fa-plus" /> Add </span></MenuItem>,
        <MenuItem eventKey="2" onClick={this.props.showDataCollectionForm}>
          Data collection
        </MenuItem>,
        <MenuItem eventKey="3" onClick={this.props.showCharacterisationForm}>
          Characterisation
        </MenuItem>,
        ...this.workflowMenuOptions(),
        <Dropdown.Divider />,
        <MenuItem header><span><MdRemove glyph="minus" /> Remove </span></MenuItem>,
        <MenuItem eventKey="1" onClick={this.props.removeSelectedSamples}>
          Dequeue Samples
        </MenuItem>,
        <MenuItem eventKey="1" onClick={this.props.removeSelectedTasks}>
          Remove Tasks
        </MenuItem>
      </>
    );
  }

  sampleContextMenu() {
    return (
      <>
        <MenuItem eventKey="1" onClick={this.props.addSelectedSamplesToQueue}>
          <span><i className="fas fa-plus" />Add to Queue</span>
        </MenuItem>,
        <MenuItem eventKey="2" onClick={this.mountAndCollect}>
          <span><MdFlare glyph="screenshot" /> Mount </span>
        </MenuItem>
      </>
    );
  }

  sampleContextMenuMounted() {
    return (
      <>
      <MenuItem eventKey="1" onClick={this.props.addSelectedSamplesToQueue}>
        <span><i className="fas fa-plus" /> Add to Queue</span>
      </MenuItem>
      <MenuItem eventKey="2" onClick={this.unmount}>
        <span><Md360 glyph="share-alt" /> Unmount </span>
      </MenuItem>
      </>
    );
  }

  render() {
    this.sampleItems = this.getSamplesList(this.props);

    return (
      <Row
        className="new-samples-grid"
        onMouseDown={this.onMouseDown}
        onMouseUp={this.onMouseUp}
        onMouseMove={this.onMouseMove}
      >
        <Col sm={3}>
          {/* <Dropdown.Menu show id="contextMenu" style={{ display: 'none' }} role="menu">
            {this.sampleContextMenu()}
            {this.taskContextMenuItems()}
          </Dropdown.Menu>
          <Dropdown.Menu
            show
            id="contextMenuMounted"
            style={{ display: 'none' }}
            role="menu"
          >
            {this.sampleContextMenuMounted()}
            {this.taskContextMenuItems()}
          </Dropdown.Menu> */}
        </Col>
        {/* <div className="selection-rubber-band" id="selectionRubberBand" /> */}
        {/* <CSSGrid
          component="ul"
          columns={2}
          columnWidth={SAMPLE_ITEM_WIDTH}
          gutterWidth={SAMPLE_ITEM_SPACE}
          gutterHeight={SAMPLE_ITEM_SPACE + 3}
          layout={layout.pinterest}
          // itemHeight={SAMPLE_ITEM_HEIGHT}
        >
          {this.getSampleTable(this.props)}
        </CSSGrid> */}
        <Col sm={12}>
          <Row className='new-samples-grid-template'>
            {/* <Col sm={6}>
              <div>
                <svg version="1.1"
                   width="750" height="800" fill='red'
                  xmlns="http://www.w3.org/2000/svg"
                 >
                   <circle cx="370" cy="400" r="360" fill="green" />
                   <text x="350" y="400" font-size="60" text-anchor="middle" fill="white">FlexHCD</text>
                </svg>
                <img src={tempIMG} className="App-logo" alt="logo" style={{ width: '750px', height: '800px' }}/>
              </div>
            </Col> */}
            <div className="selection-rubber-band" id="selectionRubberBand" />
            {this.getSampleTable(this.props)}
          </Row>
        </Col>
      </Row>
    );
  }
}
//////
/**
 * @property {Object} sampleList - list of samples
 * @property {array} order - order of samples within sample list
 * @property {array} queue - samples in queue
 * @property {object} moving - contains samples that are currently beeing moved
 * @property {object} selected - contains samples that are currently selected
 *
 */
function mapStateToProps(state) {
  return {
    workflows: state.workflow.workflows,
    queue: state.queue,
    selected: state.sampleGrid.selected,
    moving: state.sampleGrid.moving,
    sampleList: state.sampleGrid.sampleList,
    filterOptions: state.sampleGrid.filterOptions,
    order: state.sampleGrid.order,
    sampleChanger: state.sampleChanger
  };
}

function mapDispatchToProps(dispatch) {
  return {
    sendSetSampleOrderAction: (order) => dispatch(sendSetSampleOrderAction(order)),
    showTaskParametersForm: bindActionCreators(showTaskForm, dispatch),
    deleteTask: bindActionCreators(deleteTask, dispatch),
    unloadSample: bindActionCreators(unloadSample, dispatch),
    toggleMovableAction: (key) => dispatch(toggleMovableAction(key)),
    selectSamples: (keys, selected) => dispatch(selectSamplesAction(keys, selected)),
    addSampleAndMount: bindActionCreators(addSampleAndMount, dispatch),
    showDialog: bindActionCreators(showDialog, dispatch)
  };
}

NewSampleGridContainer = withRouter(NewSampleGridContainer);

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(NewSampleGridContainer);