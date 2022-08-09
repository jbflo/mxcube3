import './SampleView.css';
import React from 'react';
import {
  OverlayTrigger, Button, Dropdown,
} from 'react-bootstrap';
import 'fabric';

import OneAxisTranslationControl from '../MotorInput/OneAxisTranslationControl';
import { MOTOR_STATE } from '../../constants';

import { find } from 'lodash';

const { fabric } = window;

export default class SampleControls extends React.Component {
  constructor(props) {
    super(props);

    this.takeSnapShot = this.takeSnapShot.bind(this);
    this.doTakeSnapshot = this.doTakeSnapshot.bind(this);
    this.setZoom = this.setZoom.bind(this);
    this.toggleFrontLight = this.toggleLight.bind(this, 'frontlight');
    this.toggleBackLight = this.toggleLight.bind(this, 'backlight');
    this.toggleCentring = this.toggleCentring.bind(this);
    this.toggleDrawGrid = this.toggleDrawGrid.bind(this);
    this.availableVideoSizes = this.availableVideoSizes.bind(this);
  }

  componentDidMount() {
    window.takeSnapshot = this.doTakeSnapshot;
  }

  setZoom(option) {
    const newZoom = this.props.hardwareObjects.zoom.commands[option.target.value];
    this.props.sendSetAttribute('zoom', newZoom);
  }

  toggleDrawGrid() {
    // Cancel click centering before draw grid is started
    if (this.props.current.sampleID === '') {
      this.props.generalActions.showErrorPanel(
        true,
        'There is no sample mounted'
      );
    } else {
      if (this.props.clickCentring) {
        this.props.sampleActions.sendAbortCentring();
      }

      this.props.sampleActions.toggleDrawGrid();
    }
  }

  doTakeSnapshot() {
    const img = document.querySelector('#sample-img');
    const fimg = new fabric.Image(img);
    fimg.scale(this.props.imageRatio);
    let imgDataURI = '';
    this.props.canvas.setBackgroundImage(fimg);
    this.props.canvas.renderAll();
    imgDataURI = this.props.canvas.toDataURL({ format: 'jpeg' });
    this.props.canvas.setBackgroundImage(0);
    this.props.canvas.renderAll();
    return { data: imgDataURI.slice(23), mime: imgDataURI.slice(0, 23) };
  }

  takeSnapShot() {
    const img = this.doTakeSnapshot();
    document.querySelector('#downloadLink').href = img.mime + img.data;
    const { sampleName } = this.props.sampleList[this.props.current.sampleID];
    const filename = `${this.props.proposal}-${sampleName}.jpeg`;
    document.querySelector('#downloadLink').download = filename;
  }

  toggleCentring() {
    const { sendStartClickCentring, sendAbortCentring } =
      this.props.sampleActions;
    const { clickCentring } = this.props;

    // If draw grid tool enabled, disable it before starting centering
    if (this.props.drawGrid) {
      this.props.sampleActions.toggleDrawGrid();
    }

    if (clickCentring) {
      sendAbortCentring();
    } else {
      sendStartClickCentring();
    }
  }

  toggleLight(name) {
    const lighstate = this.props.hardwareObjects[`${name}_switch`].value;
    const newState = this.props.hardwareObjects[`${name}_switch`].commands.find(
      (state) => state !== lighstate
    );
    this.props.sendSetAttribute(`${name}_switch`, newState);
  }


  availableVideoSizes() {
    const items = this.props.videoSizes.map((size) => {
      const sizeGClass =
        this.props.width === String(size[0])
          ? 'fa-dot-circle-o'
          : 'fa-circle-o';

      return (
        <Dropdown.Item
          key={`${size[0]} x ${size[1]}`}
          eventKey="1"
          onClick={() => this.props.sampleActions.setVideoSize(size[0], size[1])}
        >
          <span className={`fa ${sizeGClass}`} />
          {' '}
          {`${size[0]} x ${size[1]}`}
        </Dropdown.Item>
      );
    });

    const autoScaleGClass = this.props.autoScale ? ' fa-check-square-o' : 'fa-square-o';

    items.push((
      <Dropdown.Item
        eventKey="3"
        key="auto scale"
        onClick={() => {
          const { clientWidth } = document.querySelector('#outsideWrapper');
          this.props.sampleActions.toggleAutoScale(clientWidth);
        }}
      >
        <span className={`fa ${autoScaleGClass}`} />
        {' '}
        Auto Scale
      </Dropdown.Item>), (
      <Dropdown.Item
        eventKey="3"
        key="reset"
        onClick={() => {
          window.initJSMpeg();
          this.props.sampleActions.setVideoSize(this.props.width, this.props.height);
        }}
      >
        <span className="fas fa-redo" />
        {' '}
        Reset
      </Dropdown.Item>));

    return items;
  }

  render() {
    const { hardwareObjects } = this.props;

    const foucs_motor_uiprop = find(
      this.props.uiproperties.components, { role: 'focus' }
    );

    const focus_motor = this.props.hardwareObjects[foucs_motor_uiprop.attribute];

    return (
      <div style={{ display: 'flex', position: 'absolute', width: '100%' }}>
        <div className="sample-controlls text-center">
          <ul className="bs-glyphicons-list">
            <li>
              <Button
                id="downloadLink"
                data-toggle="tooltip"
                title="Take snapshot"
                className="fas fa-camera sample-control"
                onClick={this.takeSnapShot}
                download
              />
              <span className="sample-control-label">Snapshot</span>
            </li>
            <li>
              <Button
                type="button"
                data-toggle="tooltip"
                title="Draw grid"
                className="fas fa-th sample-control"
                onClick={this.toggleDrawGrid}
                active={this.props.drawGrid}
              />
              <span className="sample-control-label">Draw grid</span>
            </li>
            <li>
              <Button
                type="button"
                data-toggle="tooltip"
                title="Start 3-click Centring"
                className="fas fa-circle-notch sample-control"
                onClick={this.toggleCentring}
                active={this.props.clickCentring}
              />
              <span className="sample-control-label">3-click Centring</span>
            </li>
            {process.env.focusControlOnCanvas
              ? (
                <li>
                  <OverlayTrigger
                    trigger="click"
                    rootClose
                    placement="bottom"
                    overlay={(
                      <span className="slider-overlay" style={{ marginTop: '20px' }}>
                        <OneAxisTranslationControl
                          save={this.props.sendSetAttribute}
                          value={focus_motor.value}
                          min={focus_motor.limits[0]}
                          max={focus_motor.limits[1]}
                          step={this.props.steps.focusStep}
                          motorName={foucs_motor_uiprop.attribute}
                          suffix={foucs_motor_uiprop.suffix}
                          decimalPoints={foucs_motor_uiprop.precision}
                          state={focus_motor.state}
                          disabled={this.props.motorsDisabled}
                        />
                      </span>
                    )}
                  >
                    <Button
                      name="focus"
                      type="button"
                      data-toggle="tooltip"
                      title="Focus"
                      className="fas fa-adjust sample-control"
                    />
                  </OverlayTrigger>
                  <span className="sample-control-label">Focus</span>
                </li>
              ) : null}
            <OverlayTrigger
              trigger="click"
              rootClose
              placement="bottom"
              overlay={(
                <span className="slider-overlay">
                  {hardwareObjects.zoom.limits[0]}
                  <input
                    style={{ top: '20px' }}
                    className="bar"
                    type="range"
                    id="zoom-control"
                    min={hardwareObjects.zoom.limits[0]}
                    max={hardwareObjects.zoom.limits[1]}
                    step="1"
                    value={hardwareObjects.zoom.commands.indexOf(hardwareObjects.zoom.value)}
                    disabled={hardwareObjects.zoom.state !== MOTOR_STATE.READY}
                    onMouseUp={this.setZoom}
                    onChange={(e) => {
                      this.props.setBeamlineAttribute('zoom', hardwareObjects.zoom.commands[e.target.value])
                    }}
                    list="volsettings"
                    name="zoomSlider"
                  />
                  {hardwareObjects.zoom.limits[1]}
                </span>
          )}
            >
              <li>
                <Button
                  type="button"
                  data-toggle="tooltip"
                  title="Zoom in/out"
                  className="fas fa-search sample-control"
                  name="zoomOut"
                />
                <datalist id="volsettings">
                  {[
                    ...new Array(
                      hardwareObjects.zoom.limits[1] - hardwareObjects.zoom.limits[0]
                    ).keys(),
                  ].map((i) => (
                    <option>{hardwareObjects.zoom.limits[0] + i}</option>
                  ))}
                </datalist>
                <span className="sample-control-label">Zoom</span>
              </li>
            </OverlayTrigger>
            <li>
              <Button
                style={{ paddingRight: '0px' }}
                type="button"
                data-toggle="tooltip"
                title="Backlight On/Off"
                className="fas fa-lightbulb sample-control"
                onClick={this.toggleBackLight}
                active={
                  hardwareObjects.backlight_switch.value ===
                  hardwareObjects.backlight_switch.commands[0]
                }
              />
              <OverlayTrigger
                trigger="click"
                rootClose
                placement="bottom"
                overlay={(
                  <span className="slider-overlay" style={{ marginTop: '20px' }}>
                    <input
                      style={{ top: '20px' }}
                      className="bar"
                      type="range"
                      step="0.1"
                      min={hardwareObjects.backlight.limits[0]}
                      max={hardwareObjects.backlight.limits[1]}
                      value={hardwareObjects.backlight.value}
                      disabled={hardwareObjects.backlight.state !== MOTOR_STATE.READY}
                      onMouseUp={e => this.props.sendSetAttribute('backlight', e.target.value)}
                      onChange={e => this.props.setBeamlineAttribute('backlight', e.target.value)}
                      name="backlightSlider"
                    />
                  </span>
            )}
              >
                <Button
                  type="button"
                  className="ps-2 fas fa-sort-down sample-control sample-control-small"
                />
              </OverlayTrigger>
              <span className="sample-control-label">Backlight</span>
            </li>
            <li>
              <Button
                style={{ paddingRight: '0px' }}
                type="button"
                data-toggle="tooltip"
                title="Front On/Off"
                className="fas fa-lightbulb sample-control"
                onClick={this.toggleFrontLight}
                active={
                  hardwareObjects.frontlight_switch.value === hardwareObjects.backlight_switch.commands[0]
                }
              />
              <OverlayTrigger
                trigger="click"
                rootClose
                placement="bottom"
                overlay={(
                  <span className="slider-overlay" style={{ marginTop: '20px' }}>
                    <input
                      className="bar"
                      type="range"
                      step="0.1"
                      min={hardwareObjects.frontlight.limits[0]}
                      max={hardwareObjects.frontlight.limits[1]}
                      value={hardwareObjects.frontlight.value}
                      disabled={hardwareObjects.frontlight.state !== MOTOR_STATE.READY}
                      onMouseUp={e => this.props.sendSetAttribute('frontlight', e.target.value)}
                      onChange={e => this.props.setBeamlineAttribute('frontlight', e.target.value)}
                      name="frontLightSlider"
                    />
                  </span>
)}
              >
                <Button
                  type="button"
                  className="ps-2 fas fa-sort-down sample-control sample-control-small"
                />
              </OverlayTrigger>
              <span className="sample-control-label">Frontlight</span>
            </li>
            <li>
              <Dropdown>
                <Dropdown.Toggle
                  className="sample-control"
                  variant="content"
                  id="video-size-dropdown"
                  style={{ lineHeight: '0' }}
                  >
                  <i className="fas fa-1x fa-video" />
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {this.availableVideoSizes()}
                </Dropdown.Menu>
              </Dropdown>
              <span className="sample-control-label">Video size</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }
}
