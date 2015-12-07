from flask import session, redirect, url_for, render_template, request, Response, jsonify
from mxcube3 import app as mxcube
import logging
import itertools

@mxcube.route("/mxcube/api/v0.1/sample_changer/samples_list")
def get_samples_list():
    samples_list = mxcube.sample_changer.getSampleList()
    samples = {}
    	for s in samples_list:
    		samples.update({s.getAddress(): { "id": s.getAddress(), "location": ":".join(map(str, s.getCoords())), "holderLength": 22.0, "code": 42, "containerSampleChangerLocation": "4", "proteinAcronym": "A-TIM", "cellGamma": 0.0, "cellAlpha":0.0, "sampleId": 493129, "cellBeta": 0.0, "crystalSpaceGroup": "P21212", "sampleLocation": "4", "sampleName": "f01", "cellA": 0.0, "diffractionPlan": "px33", "cellC": 0.0, "cellB": 0.0, "experimentType": "MXPressO"}})
    return jsonify(samples)
