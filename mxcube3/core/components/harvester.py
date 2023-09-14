# -*- coding: utf-8 -*-
import logging
import time
import gevent

from mxcubecore import queue_entry
from mxcubecore import HardwareRepository as HWR

from mxcube3.core.components.component_base import ComponentBase
from mxcube3.core.components.queue import COLLECTED, UNCOLLECTED

from mxcubecore.HardwareObjects.abstract.sample_changer import Crims

# TO CONSIDER:
# This should maybe be made into a adapter instead of a component
class Harvester(ComponentBase):
    def __init__(self, app, config):
        super().__init__(app, config)

    
    def init_signals(self):
        from mxcube3.routes import signals

        """Initialize hwobj signals."""
        HWR.beamline.harvester.connect("stateChanged", signals.harvester_state_changed)

        HWR.beamline.harvester.connect(
            "contentsUpdated", signals.harvester_contents_update
        )

        if HWR.beamline.harvester_maintenance is not None:
            HWR.beamline.harvester_maintenance.connect(
                "globalStateChanged", signals.sc_maintenance_update
            )

    
    def get_initial_state(self):
        if HWR.beamline.harvester_maintenance is not None:
            global_state, cmdstate, msg = HWR.beamline.harvester_maintenance.get_global_state()

            cmds = HWR.beamline.harvester_maintenance.get_cmd_info()
        else:
            global_state = {}
            cmdstate = "harvester maintenance controller not defined"
            cmds = []
            msg = ""

        contents = self.get_harvester_contents()

        try:
            state = HWR.beamline.harvester.get_status().upper()
        except:
            state = "OFFLINE"

        initial_state = {
            "state": state,
            "contents": contents,
            "global_state": {"global_state": global_state, "commands_state": cmdstate},
            "cmds": {"cmds": cmds},
            "msg": msg,
            "plate_mode": HWR.beamline.diffractometer.in_plate_mode(),
        }

        return initial_state
    


    def get_harvester_contents(self):
        # import pdb; pdb.set_trace()
        if HWR.beamline.harvester:
            root_name = HWR.beamline.harvester.__TYPE__
            crystal_list = self.get_crystal_list()
            room_temperature = HWR.beamline.harvester.get_room_temperature()
            number_of_pins = HWR.beamline.harvester.get_number_of_available_pin()
            contents = {
                "name": root_name,
                "harverster_crystal_list": crystal_list,
                "number_of_pins": number_of_pins,
                "calibration_state": self.get_calibrate_state(),
                "room_temperature": room_temperature
            }
        else:
            contents = {"name": "OFFLINE"}

        return contents

    def get_sample_info(self, crystal_uuid):
        samples_list = HWR.beamline.sample_changer.get_sample_list()
        sample_data = {}
        for s in samples_list:
            if s.get_id() == crystal_uuid:
                sample_data = {
                    "location": s.get_address(),
                    "sampleID": s.get_address(),
                    "crystalUUID": s.get_id(),
                    "sampleName": s.get_name()
                }
                return sample_data

        return sample_data

    def get_crystal_list(self):
        crystal_list = []

        try:
            harvester_device = HWR.beamline.harvester
            crystal_uuids = harvester_device.get_crystal_uuids()
            crystal_names = harvester_device.get_sample_names()
            crystal_acronymes = harvester_device.get_sample_acronyms()
            sample_states = harvester_device.get_samples_state()
            for index, x_tal in enumerate(crystal_uuids):
                img_url = HWR.beamline.harvester.get_crystal_images_urls(x_tal)
                img_target_x = HWR.beamline.harvester.get_image_target_x(x_tal)
                img_target_y = HWR.beamline.harvester.get_image_target_y(x_tal)

                if len(crystal_acronymes) > 0 and len(crystal_acronymes) == len(crystal_uuids):
                    proteinAcronym = crystal_acronymes[index]
                else:
                    proteinAcronym = crystal_acronymes[0] if len(crystal_acronymes) > 0 else ''
                lst = {
                    "crystal_uuid": x_tal,
                    "name": crystal_names[index],
                    "state": sample_states[index],
                    "acronym": proteinAcronym,
                    "img_url": img_url,
                    "img_target_x": img_target_x,
                    "img_target_y": img_target_y
                }
                crystal_list.append(lst)
        except Exception as ex:
            print("Could not get Crystal List : %s"  % str(ex))
            # TEMP return a fake list
            crystal_list = [
                {
                    "crystal_uuid": "94730c39-bf66-416f-ab97-f755e45f6a3b",
                    "name": "TEST1",
                    "acronym": "cryoprotectant",
                    "img_url": "https://htxlab.embl.fr/agility/plates/CD032401/inspections/6/images/B5-1/types/webimages"
                },
                {
                    "crystal_uuid": "94730c39-bf66-416f-ab97-f755e45f6a3a",
                    "name": "TEST12",
                    "acronym": "cryoprotectant",
                    "img_url": "https://htxlab.embl.fr/agility/plates/CD032401/inspections/6/images/B5-1/types/webimages"
                },
                {
                    "crystal_uuid": "94730c39-bf66-416f-ab97-f755e45f6a3m",
                    "name": "TEST13",
                    "acronym": "cryoprotectant",
                    "img_url": "https://htxlab.embl.fr/agility/plates/CD032401/inspections/6/images/B5-1/types/webimages"
                },
            ]
        
        return crystal_list


    def get_global_state(self):
        try:
            return HWR.beamline.harvester_maintenance.get_global_state()
        except:
            return "OFFLINE", "OFFLINE", "OFFLINE"


    def send_data_collection_info_to_crims(self):
        # import pdb; pdb.set_trace()

        datacollectionGroupId = ''
        crystal_uuid =  ''

        try:
            rest_token = HWR.beamline.lims.lims_rest.get_rest_token()
            proposal = HWR.beamline.session.get_proposal()

            crims_url = "https://htxlab.embl.fr/ispyb_checker/api/v2/crystal/"

            queue_entries = HWR.beamline.queue_model.get_all_dc_queue_entries()
            di_id = []
            for qe in queue_entries:
                datacollectionGroupId = qe.get_data_model().lims_group_id
                crystal_uuid =  qe.get_data_model().get_sample_node().crystals[0].crystal_uuid
                di_id= qe.get_data_model().id

                Crims.send_data_collection_info_to_crims(crims_url, crystal_uuid, datacollectionGroupId, di_id, proposal, rest_token)
            return True  
        except Exception as ex:
            msg = "get all queue entries failed, reason:  %s" % str(ex)
            return msg   



    def get_calibrate_state(self):
        return HWR.beamline.harvester.calibrate_state


    def calibrate_pin(self):
        """
        Pin Calibration Procedure here
        """
        # send_data_collection_info_to_crims() # to be remove later
        # import pdb; pdb.set_trace()
        harvester_device = HWR.beamline.harvester

        harvester_device.load_calibrated_pin()
        harvester_device._wait_sample_transfer_ready(None)
        print("waiting 40 seconds before mount")
        # For some reason the Harvester return READY too soon
        # approximately 40 SEcond sooner
        sleep(40)
        sample_mount_device = HWR.beamline.sample_changer
        mount_current_sample = sample_mount_device.single_load()

        if mount_current_sample:
            try:
                md = HWR.beamline.diffractometer
                md._wait_ready()

                sample_drift_x = float(harvester_device.get_last_sample_drift_offset_x())
                sample_drift_y = float(harvester_device.get_last_sample_drift_offset_y())
                sample_drift_z = float(-harvester_device.get_last_sample_drift_offset_z())
                
                motor_pos_dict = {
                    "kappa": float(harvester_device.centring_calibration_hobj.kappa_ref_value), # 95.35,
                    "kappa_phi": float(harvester_device.centring_calibration_hobj.phi_ref_value), #351,
                    "phi": float(harvester_device.centring_calibration_hobj.omega_ref_value),  #315,
                    "phiy": md.phiyMotor.get_value() +   sample_drift_x,
                }

                md.move_motors(motor_pos_dict)
                md._wait_ready()
                md.centringFocus.set_value_relative(sample_drift_z, None)
                md.centringVertical.set_value_relative(sample_drift_y, None)
                
                md.save_current_motor_position()
                harvester_device.set_calibrate_state(True)

                print("Pin Calibration Step 1 Succeed")
                return True
            except Exception:
                print("Pin Calibration Failed")
                return False
        else:
            print("Pin Calibration Failed")
            print("Sample Changer could not mount Pin")
            return False

    def cancel_calibration(self):
        harvester_device = HWR.beamline.harvester
        harvester_device.set_calibrate_state(False)

    def validate_calibration(self):
        """
        finish Calibration Procedure 
        after user ran a 3 click centring
        """
        harvester_device = HWR.beamline.harvester
        md = HWR.beamline.diffractometer
        
        motor_pos_dict = {
            "focus": md.focusMotor.get_value(),
            "phiy": md.phiyMotor.get_value(),
            "phiz": md.phizMotor.get_value(),
            "centring_focus": md.centringFocus.get_value(),
            "centring_vertical": md.centringVertical.get_value()
        }

        saved_position = md.saved_motor_position

        new_motor_offset= {
            "focus":motor_pos_dict["focus"] - saved_position["focus"],
            "phiy": motor_pos_dict["phiy"] - saved_position["phiy"],
            "phiz": motor_pos_dict["phiz"] - saved_position["phiz"],
            "centring_focus":motor_pos_dict["centring_focus"] - saved_position["centring_focus"],
            "centring_vertical":motor_pos_dict["centring_vertical"] - saved_position["centring_vertical"],
        }

        calibrated_motor_offset= {
            "focus": new_motor_offset["focus"] + new_motor_offset["centring_focus"],
            "phiy": new_motor_offset["phiy"],
            "phiz": new_motor_offset["phiz"] + new_motor_offset["centring_vertical"],
        }

        # temp solution save them to memory
        print(calibrated_motor_offset)
        harvester_device.store_calibrated_pin(
            calibrated_motor_offset["focus"], calibrated_motor_offset["phiy"], calibrated_motor_offset["phiz"])

        harvester_device.set_calibrate_state(False)
        return

    def get_sample_info(self, location):
        samples_list = HWR.beamline.sample_changer.get_sample_list()
        sample_data = {}
        for s in samples_list:
            if s.get_address() == location:
                sample_data = {
                    "location": s.get_address(),
                    "crystalUUID": s.get_id(),
                    "sampleName": s.get_name()
                }
                return sample_data

        return sample_data
    

    def harverst_and_mount_sample(self, xtal_uuid):
        try:
            harvester_device = HWR.beamline.harvester

            self.harvest_crystal(xtal_uuid)
            harvester_device._wait_sample_transfer_ready(None)

            sample = self.get_sample_info(xtal_uuid)
            self.app.sample_changer.mount_sample(sample)
        except:
            return "Coul not Harvest Crystal"
            
        self.init_signals()
        return self.get_harvester_contents()
    

    def harvest_sample_before_mount(self, sample_uuid, wait_before_load=False):

        harvester_device = HWR.beamline.harvester
        res = None

        if harvester_device and sample_uuid:
            if harvester_device.get_status() == "Ready":
                try:
                    if harvester_device.check_crystal_state(sample_uuid) == 'pending_not_current':
                        print(harvester_device.get_samples_state())
                        logging.getLogger("user_level_log").info("Harvester:Trashing pending Sample")
                        harvester_device.trash_sample()
                        harvester_device._wait_ready(None)
    
                    # currently_harvested_sample = harvester_device.get_current_crystal()
                    if harvester_device.current_crystal_state(sample_uuid) == "ready_to_execute" or harvester_device.current_crystal_state(sample_uuid) == "needs_repositionning":
                        # import pdb; pdb.set_trace()
                        logging.getLogger("user_level_log").info("Harvesting started")
                        harvester_device.harvest_crystal(sample_uuid)
                        if wait_before_load:
                            harvester_device._wait_sample_transfer_ready(None)
                        res = True
                    elif harvester_device.check_crystal_state(sample_uuid) == "pending_and_current":
                        logging.getLogger("user_level_log").info("Putting Harvester in Tansfer Mode")
                        harvester_device.transfer_sample()
                        if wait_before_load:
                            harvester_device._wait_sample_transfer_ready(None)
                        res = True
                    else:
                        # logging.getLogger("user_level_log").info("ERROR: Sample Could not be Harvested (Harvester Ready, ) ")
                        msg = harvester_device.get_status()
                        logging.getLogger("user_level_log").exception("ERROR: Sample Could not be Harvested")
                        logging.getLogger("user_level_log").exception(msg)

                        res = False

                    return res   
                except RuntimeError:
                    return False
                
            elif harvester_device._ready_to_transfer():
                try:
                    if harvester_device.current_crystal_state(sample_uuid) == "waiting_for_transfer":
                        logging.getLogger("user_level_log").info("Sample Already Harvested, continue")
                        res = True
                    else:
                        harvester_device.abort()
                        harvester_device._wait_ready(None)
                        logging.getLogger("user_level_log").info("Trash current Sample")
                        harvester_device.trash_sample()
                        harvester_device._wait_ready(None)
                        if harvester_device.current_crystal_state(sample_uuid) == "ready_to_execute" or harvester_device.current_crystal_state(sample_uuid) == "needs_repositionning":
                            logging.getLogger("user_level_log").info("Harvesting started")
                            harvester_device.harvest_crystal(sample_uuid)
                            if wait_before_load:
                                harvester_device._wait_sample_transfer_ready(None)
                            res = True
                        else: 
                            msg = harvester_device.get_status()
                            logging.getLogger("user_level_log").info("Warning: Sample Could not be Harvested Try Again")
                            return harvest_sample_before_mount(sample_uuid)

                    return res
                except RuntimeError:
                    return False
            elif("Harvesting" in harvester_device.get_status()  or harvester_device.get_status() == "Finishing Harvesting"):
                logging.getLogger("user_level_log").info("Warning: Harvesting In Progress Try Again")
                harvester_device._wait_sample_transfer_ready(None)
                return self.harvest_sample_before_mount(sample_uuid)
            else:
                msg = harvester_device.get_status()
                logging.getLogger("user_level_log").exception("ERROR: Sample Could not be Harvested")
                logging.getLogger("user_level_log").exception(msg)
                # Try an abort and move to next sample
                harvester_device.abort()
                harvester_device._wait_ready(None)
                return False
        else:
            msg = harvester_device.get_status()
            logging.getLogger("user_level_log").exception("ERROR: No sample uuid or Harvester Device FOund")
            logging.getLogger("user_level_log").exception(msg)
            # Try an abort and move to next sample
            return False


    def current_queue_index(self, current_sample):
        current_queue_dict = self.app.queue.queue_to_dict()
        current_queue_list = list(current_queue_dict)
        res = None
        try:
            res = current_queue_list.index(current_sample)
        except (ValueError, IndexError):
            res = None

        return res


    def get_next_sample(self, current_sample):
        current_queue_dict = self.app.queue.queue_to_dict()
        current_queue_list = list(current_queue_dict)
        res = None
        try:
            res = current_queue_list[current_queue_list.index(current_sample) + 1]
        except (ValueError, IndexError):
            res = None

        return res


    def queue_harvest_sample(self, data_model, sample):
        current_queue = self.app.queue.queue_to_dict()
        harvester_device = HWR.beamline.harvester
        wait_before_load  =  True if harvester_device.get_room_temperature() == False else False
        if harvester_device.get_number_of_available_pin() > 0 :
            gevent.sleep(2)
            sample_UUID = current_queue[sample["sampleID"]]["code"]
            if self.current_queue_index(data_model.loc_str) == 1:
                logging.getLogger("user_level_log").info("Harvesting First Sample")
                if sample_UUID in ["undefined", "", None]:
                    sample_info = self.get_sample_info(sample["location"])
                    sample_UUID = sample_info["crystalUUID"]
                harvest_res = self.harvest_sample_before_mount(sample_UUID, wait_before_load)
                if harvest_res == False:
                    # if sample could not be Harvest, but no exception is raised, let's skip the sample
                    raise queue_entry.QueueSkippEntryException (
                        "Harvester could not Harvest sample", ""
                    )
            else:
                logging.getLogger("user_level_log").info("checking last Harvesting")
                harvest_res = self.harvest_sample_before_mount(sample_UUID, wait_before_load)
                if harvest_res == False:
                    # if sample could not be Harvest, but no exception is raised, let's skip the sample
                    raise queue_entry.QueueSkippEntryException (
                        "Harvester could not Harvest sample", ""
                    )
        elif harvester_device.get_number_of_available_pin() == 0 and harvester_device._ready_to_transfer():
            logging.getLogger("user_level_log").warning("Warning: Harvester pins is approaching to ZERO")
            logging.getLogger("user_level_log").warning("Warning: Mounting last Sample, Queue will stop on next one")
        else:
            # raise Not enough pins available in the pin provider
            raise queue_entry.QueueSkippEntryException (
                "There is no more Pins in the Harvester, Stopping queue", ""
            )


    def queue_harvest_sample_next(self, data_model, sample):
        next_sample = self.get_next_sample(data_model.loc_str)
        harvester_device = HWR.beamline.harvester
        current_queue = self.app.queue.queue_to_dict()
        if next_sample  is not None and harvester_device.get_number_of_available_pin() > 0:
            logging.getLogger("user_level_log").info("Harvesting Next Sample")
            sample_UUID = current_queue[next_sample]["code"]
            if sample_UUID in ["undefined", "", None]:
                sample_info = self.get_sample_info(sample["location"])
                sample_UUID = sample_info["crystalUUID"]
            harvester_device._wait_ready(None)
            self.harvest_sample_before_mount(sample_UUID, False)
        else:
            logging.getLogger("user_level_log").warning("Warning: Could not harvest next sample")

    def harvest_crystal(self, xtal_uuid):
        try:
            return HWR.beamline.harvester.harvest_crystal(xtal_uuid)
        except:
            return "Coul not Harvest Crystal"

    def get_sample_drift_centring(self):
        try:
            HWR.beamline.harvester.harvest_crystal(xtal_uuid)
            sample_drift_x = float(HWR.beamline.harvester.get_last_sample_drift_offset_x())
            sample_drift_y = float(-HWR.beamline.harvester.get_last_sample_drift_offset_y())
            sample_drift_z = float(HWR.beamline.harvester.get_last_sample_drift_offset_z())

            sample_drift = (sample_drift_x, sample_drift_y, sample_drift_z)
        except:
            return "Coul not Harvest Crystal"