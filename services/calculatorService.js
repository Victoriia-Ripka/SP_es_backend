function getFittingPanelCountOnRoof({ panelWidth, panelLength, areaWidth, areaLength, distanceBetweenPanels = 20
}) {
    // допоміжна функція для обрахунків
    function countPanelsInOrientation(pW, pL) {
        const totalPanelWidth = pW + distanceBetweenPanels;
        const totalPanelLength = pL + distanceBetweenPanels;

        const cols = Math.floor(areaWidth / totalPanelWidth);
        const rows = Math.floor(areaLength / totalPanelLength) || 1;

        return {
            count: cols * rows,
            rows,
            cols
        };
    }

    const horizontal = countPanelsInOrientation(panelWidth, panelLength);
    const vertical = countPanelsInOrientation(panelLength, panelWidth);

    if (horizontal.count >= vertical.count) {
        return {
            orientation: "горизонтальна",
            ...horizontal
        };
    } else {
        return {
            orientation: "вертикальна",
            ...vertical
        };
    }
}

function getFittingPanelCountOnGround({ panelWidth, panelLength, areaWidth, areaLength, distanceAmongPanels = 2, beta, a
}) {
    // шиманський стр. 144
    const d = 2 * panelLength + distanceAmongPanels;
    const distanceAmongRows = (d * Math.sin(beta)) / Math.sin(a);

    // допоміжна функція для обрахунків
    const countPanelsInOrientation = (pW) => {
        const rows = Math.floor(areaLength / distanceAmongRows) || 1;
        const cols = Math.floor(areaWidth / pW);
        return {
            count: cols * rows,
            rows,
            cols
        };
    };

    const vertical = countPanelsInOrientation(panelLength);
    const horizontal = countPanelsInOrientation(panelLength); // широка сторона – це довга сторона в горизонтальній орієнтації

    if (horizontal.count > vertical.count) {
        return {
            orientation: "горизонтальна",
            ...horizontal,
            distance_between_rows: Number(parseFloat((distanceAmongRows / 1000).toFixed(2)))
        };
    } else {
        return {
            orientation: "вертикальна",
            ...vertical,
            distance_between_rows: Number(parseFloat((distanceAmongRows / 1000).toFixed(2)))
        };
    }
}

function determinePanelConnectionType(panel, inverter) {
    const Voc = panel.open_circuit_voltage_v;
    const Vmp = panel.voltage_at_maximum_power_v;
    const Imp = panel.current_at_maximum_power_a;
    const Pmp = panel.maximum_power_w;

    const maxInputVoltage = inverter.max_input_voltage_v;
    const mpptMin = inverter.mppt_voltage_range_v?.min ?? inverter.input_voltage_range_dc_v.min;
    const mpptMax = inverter.mppt_voltage_range_v?.max ?? inverter.input_voltage_range_dc_v.max;
    const maxCurrent = Array.isArray(inverter.input_current_a)
        ? Math.max(...inverter.input_current_a)
        : inverter.input_current_a;

    const panelCount = panel.count;

    const results = [];

    // ========== ЗМІШАНЕ ПІДКЛЮЧЕННЯ (N x M) ==========
    for (let seriesCount = 1; seriesCount <= panelCount; seriesCount++) {
        const totalVoc = seriesCount * Voc;
        const totalVmp = seriesCount * Vmp;

        // перевірка на відповідність даному стрінгу панелей до інвертора
        if (totalVoc > maxInputVoltage || totalVmp < mpptMin || totalVmp > mpptMax) {
            continue; 
        }

        const maxParallelStrings = Math.floor(maxCurrent / Imp);
        const maxStringsByPanels = Math.floor(panelCount / seriesCount);
        const parallelStrings = Math.min(maxParallelStrings, maxStringsByPanels);

        if (parallelStrings < 1) continue;

        const totalPanels = seriesCount * parallelStrings;
        const totalPowerKw = (Pmp * totalPanels) / 1000;
        const totalCurrent = Imp * parallelStrings;

        results.push({
            panel_type_connection: 'змішане',
            seriesCount,
            parallelStrings,
            number_panels_in_system: totalPanels,
            max_pv_power_for_params_kW: parseFloat(totalPowerKw.toFixed(3)),
            voltage: totalVmp.toFixed(2),
            current: totalCurrent.toFixed(2)
        });
    }

    // ========== ПОСЛІДОВНЕ ==========
    const maxSeriesVoc = Math.floor(maxInputVoltage / Voc);
    const maxSeriesVmp = Math.floor(mpptMax / Vmp);
    const minSeriesVmp = Math.ceil(mpptMin / Vmp);
    const bestSeriesCount = Math.min(maxSeriesVoc, maxSeriesVmp, panelCount);

    if (bestSeriesCount >= minSeriesVmp) {
        const seriesPowerKw = (Pmp * bestSeriesCount) / 1000;

        results.push({
            panel_type_connection: 'послідовне',
            number_panels_in_system: bestSeriesCount,
            max_pv_power_for_params_kW: parseFloat(seriesPowerKw.toFixed(3)),
            voltage: (bestSeriesCount * Vmp).toFixed(2),
            current: Imp.toFixed(2)
        });
    }

    // ========== ПАРАЛЕЛЬНЕ ==========
    const maxParallelCount = Math.floor(maxCurrent / Imp);
    const parallelCount = Math.min(maxParallelCount, panelCount);

    if (parallelCount > 0) {
        const parallelPowerKw = (Pmp * parallelCount) / 1000;

        results.push({
            panel_type_connection: 'паралельне',
            number_panels_in_system: parallelCount,
            max_pv_power_for_params_kW: parseFloat(parallelPowerKw.toFixed(3)),
            voltage: Vmp.toFixed(2),
            current: (Imp * parallelCount).toFixed(2)
        });
    }

    // ========== ВИБІР НАЙКРАЩОГО ==========
    const best = results.sort((a, b) => b.max_pv_power_for_params_kW - a.max_pv_power_for_params_kW)[0];

    return best || null;
}

function getSuitableBatteryChargeCount({ inverter, charges }) {
    const minBatteryPower = inverter.nominal_power_dc_kW * 1.5;
    const maxBatteryPower = inverter.nominal_power_dc_kW * 2.5;
    const requiredVoltage = inverter.battery_voltage_v;
    const maxChargeCurrent = inverter.max_charge_current_a;

    const suitableCharges = charges
        .map(charge => {
            const voltageInRange = charge.voltage_range_V && charge.voltage_range_V.min <= requiredVoltage && charge.voltage_range_V.max >= requiredVoltage;
            const nominalVoltageMatch = charge.nominal_voltage_V === requiredVoltage;

            if (!voltageInRange && !nominalVoltageMatch) return null;

            const chargeCapacity = charge.battery_capacity_kWh;

            // визначити, скільки блоків потрібно, щоб досягти принаймні minBatteryPower
            const minCount = Math.ceil(minBatteryPower / chargeCapacity);
            const maxCount = Math.floor(maxBatteryPower / chargeCapacity);

            if (minCount <= 0 || maxCount <= 0) return null;

            // оцінити загальне споживання струму за необхідної напруги (приблизно)
            const powerForCurrentCheck = minCount * chargeCapacity * 1000; // конвертація кВт*год у Вт
            const estimatedCurrent = powerForCurrentCheck / requiredVoltage;

            if (estimatedCurrent > maxChargeCurrent) return null;

            const cleanCharge = charge.toObject();

            return {
                ...cleanCharge,
                charge_count: minCount,
                total_charge_capacity_kWh: (minCount * chargeCapacity).toFixed(2),
            };
        })
        .filter(Boolean);

    return suitableCharges;
}

const generateCombinations = (suitableElements) => {
    const combinations = [];

    suitableElements.forEach(item => {
        const { inverter, compatiblePanels, suitableCharges } = item;

        compatiblePanels.forEach(panel => {
            const panelCount = panel.number_panels_in_system;
            const panelWeight = panel.weight;
            const panelPrice = panel.price;
            const panelPowerW = panel.maximum_power_w;

            const baseCombination = {
                inverter,
                panel,
                total_panel_weight_kg: (panelCount * panelWeight).toFixed(1),
                total_power_kW: ((panelCount * panelPowerW) / 1000).toFixed(2),
                total_price: (inverter.price + panelCount * panelPrice).toFixed(2)
            };

            if (suitableCharges && suitableCharges.length > 0) {
                suitableCharges.forEach(charge => {
                    const { charge_count, price: chargePrice } = charge;

                    const total_price = (Number(baseCombination.total_price) + charge_count * chargePrice).toFixed(2)

                    combinations.push({
                        ...baseCombination,
                        charge,
                        total_price
                    });
                });
            } else {
                combinations.push(baseCombination);
            }
        });
    });

    return combinations;
};


export const CalculatorService = {
    getFittingPanelCountOnRoof,
    getFittingPanelCountOnGround,
    determinePanelConnectionType,
    getSuitableBatteryChargeCount,
    generateCombinations
}