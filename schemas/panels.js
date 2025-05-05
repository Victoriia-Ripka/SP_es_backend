import { Schema, model } from "mongoose";

const panelSchema = new Schema(
    {
        producer: {
            type: String,
        },
        model: {
            type: String,
        },
        maximum_power_w: {
            type: Number,
        },
        open_circuit_voltage_v: {
            type: Number,
        },
        voltage_at_maximum_power_v: {
            type: Number,
        },
        current_at_maximum_power_a: {
            type: Number,
        },
        efficiency: {
            type: Number,
        },
        power_output_tolerance_: {
            type: [Number]
        },
        maximum_system_voltage_v: {
            type: Number
        },
        weight: {
            type: Number,
        },
        dimension: {
            length: Number,
            width: Number
        },
        type: {
            type: String,
            enum: ['monocrystalline', 'policrystalline'],
        },
        cell_configuration: {
            type: String,
        },
        price: {
            type: Number,
        },
    }
);

const Panels = model("panels", panelSchema);

export default Panels;