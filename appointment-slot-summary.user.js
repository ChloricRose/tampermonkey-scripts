// ==UserScript==
// @name         Appointment Slot Summary (Enhanced with Ocean Slots Fix)
// @namespace    http://tampermonkey.net/
// @version      3.8
// @description  Summary of Vendor, Ocean, TSI, and Parcel slots with proper unit calculations.
// @author       juanfelv
// @match        https://fc-inbound-dock-hub-eu.aka.amazon.com/es_ES/
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ChloricRose/tampermonkey-scripts/main/appointment-slot-summary.user.js
// @downloadURL  https://raw.githubusercontent.com/ChloricRose/tampermonkey-scripts/main/appointment-slot-summary.user.js
// ==/UserScript==


(function () {
    'use strict';

    const targetClasses = [
        'appointment_slot ARRIVAL_SCHEDULED',
        'appointment_slot ARRIVED',
        'appointment_slot CHECKIN_SCHEDULE',
        'appointment_slot CHECKED_IN',
        'appointment_slot UNLOADED',
        'appointment_slot CLOSED'
    ];

    const iconLegend = {
        'fa fa-truck': 'Vendor',
        'fa fa-exchange': 'TSI',
        'fa fa-cubes': 'Parcel',
        'fa fa-link': 'LIVE'
    };

    const parcelUnitEstimate = 800;
    const EARLY_THRESHOLD = 2540;
    let observer = null;
    let panelsManuallyMoved = false;

    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    }

    function updateSlotCount(summary, slotClass, category) {
        switch (category) {
            case 'Vendor':
                if (slotClass === 'ARRIVAL_SCHEDULED') summary.vendorScheduled++;
                if (slotClass === 'ARRIVED') summary.vendorArrived++;
                if (slotClass === 'CHECKIN_SCHEDULE') summary.vendorCheckIn++;
                if (slotClass === 'UNLOADED') summary.vendorUnloaded++;
                if (slotClass === 'CLOSED') summary.vendorClosed++;
                break;
            case 'TSI':
                if (slotClass === 'ARRIVAL_SCHEDULED') summary.tsiScheduled++;
                if (slotClass === 'ARRIVED') summary.tsiArrived++;
                if (slotClass === 'CHECKIN_SCHEDULE') summary.tsiCheckIn++;
                if (slotClass === 'UNLOADED') summary.tsiUnloaded++;
                if (slotClass === 'CLOSED') summary.tsiClosed++;
                break;
            case 'Parcel':
                if (slotClass === 'ARRIVAL_SCHEDULED') summary.parcelScheduled++;
                if (slotClass === 'ARRIVED') summary.parcelArrived++;
                if (slotClass === 'CHECKIN_SCHEDULE') summary.parcelCheckIn++;
                if (slotClass === 'UNLOADED') summary.parcelUnloaded++;
                if (slotClass === 'CLOSED') summary.parcelClosed++;
                break;
            case 'Ocean':
                if (slotClass === 'ARRIVAL_SCHEDULED') summary.oceanScheduled++;
                if (slotClass === 'ARRIVED') summary.oceanArrived++;
                if (slotClass === 'CHECKIN_SCHEDULE') summary.oceanCheckIn++;
                if (slotClass === 'UNLOADED') summary.oceanUnloaded++;
                if (slotClass === 'CLOSED') summary.oceanClosed++;
                break;
        }

        if (slotClass === 'ARRIVAL_SCHEDULED') summary.totalScheduled++;
        if (slotClass === 'ARRIVED') summary.totalArrived++;
        if (slotClass === 'CHECKIN_SCHEDULE') summary.totalCheckIn++;
        if (slotClass === 'UNLOADED') summary.totalUnloaded++;
        if (slotClass === 'CLOSED') summary.totalClosed++;
    }

    function enableDrag(panel, handle) {
        let offsetX = 0;
        let offsetY = 0;
        let isDragging = false;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            panelsManuallyMoved = true;
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            panel.style.position = 'fixed';
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.zIndex = 10001;
            document.body.appendChild(panel);

            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            handle.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;
                panel.style.left = `${x}px`;
                panel.style.top = `${y}px`;
                panel.style.right = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                handle.style.cursor = 'move';
            }
        });
    }

    function adjustLatePanelPosition() {
        if (panelsManuallyMoved) return;
        const earlyPanel = document.getElementById('summary-panel-early');
        const latePanel = document.getElementById('summary-panel-late');
        if (earlyPanel && latePanel) {
            const rect = earlyPanel.getBoundingClientRect();
            latePanel.style.top = `${rect.bottom + 20 + window.scrollY}px`;
        }
    }

    function createSummaryPanel(id, titleText) {
        const panel = document.createElement('div');
        panel.id = id;
        const initialTop = id === 'summary-panel-early' ? 90 : 250;
        panel.style = `
            position: fixed;
            top: ${initialTop}px;
            right: 20px;
            background-color: #fdfdfd;
            border-radius: 12px;
            border: 1px solid #ddd;
            padding: 0;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
            font-family: Arial, sans-serif;
            color: #333;
            z-index: 10000;
            max-width: 350px;
            min-width: 220px;
            width: 90vw;
            max-height: 60vh;
            overflow: auto;
        `;

        const header = document.createElement('div');
        header.style = `
            background-color: #007bff;
            color: white;
            padding: 10px;
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 2;
            cursor: move;
        `;
        // Minimize button
        const minimizeBtn = document.createElement('button');
        minimizeBtn.textContent = '–';
        minimizeBtn.style = `
            float: right;
            background: transparent;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            margin-left: 10px;
        `;
        header.appendChild(minimizeBtn);

        const title = document.createElement('h3');
        title.textContent = titleText;
        title.style = 'margin: 0; font-size: 20px; display: inline-block;';
        header.appendChild(title);
        panel.appendChild(header);

        const summary = document.createElement('div');
        summary.id = `${id}-content`;
        summary.style = 'padding: 15px; font-size: 16px; line-height: 1.6; overflow-y: auto; max-height: 40vh;';
        panel.appendChild(summary);

        const footer = document.createElement('div');
        footer.textContent = 'Designed by cricer Developed by juanfelv';
        footer.style = 'padding: 10px; font-size: 12px; text-align: center; color: #999; border-top: 1px solid #ddd;';
        panel.appendChild(footer);

        minimizeBtn.addEventListener('click', () => {
            const isMinimized = panel.classList.toggle('minimized');
            if (isMinimized) {
                summary.style.display = 'none';
                footer.style.display = 'none';
                minimizeBtn.textContent = '+';
            } else {
                summary.style.display = '';
                footer.style.display = '';
                minimizeBtn.textContent = '–';
            }
        });

        enableDrag(panel, header);
        document.body.appendChild(panel);
    }

    function updateSummaryPanel(id, summaryData) {
        const summary = document.getElementById(`${id}-content`);
        summary.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background-color: #f2f2f2;">
                    <th style="position: sticky; left: 0; background: #f2f2f2; z-index: 2; text-align: left; padding: 8px; box-shadow: 2px 0 5px -2px #888;">Category</th>
                    <th style="text-align: right; padding: 8px;">Count</th>
                    <th style="text-align: right; padding: 8px;">Units</th>
                    <th style="text-align: right; padding: 8px;">Scheduled</th>
                    <th style="text-align: right; padding: 8px;">Arrived</th>
                    <th style="text-align: right; padding: 8px;">Check-In</th>
                    <th style="text-align: right; padding: 8px;">Unloaded</th>
                    <th style="text-align: right; padding: 8px;">Closed</th>
                </tr>
                <tr style="background-color: #ffffff;">
                    <td style="position: sticky; left: 0; background: #fff; z-index: 1; padding: 8px; box-shadow: 2px 0 5px -2px #888;"><strong>Total</strong></td>
                    <td style="text-align: right; padding: 8px;">${summaryData.totalSlots}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.totalUnits}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.totalScheduled}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.totalArrived}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.totalCheckIn}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.totalUnloaded}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.totalClosed}</td>
                </tr>
                <tr style="background-color: #f2f2f2;">
                    <td style="position: sticky; left: 0; background: #f2f2f2; z-index: 1; padding: 8px; box-shadow: 2px 0 5px -2px #888;"><i class="fa fa-truck"></i> Vendor</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.vendorCount}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.vendorUnits}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.vendorScheduled}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.vendorArrived}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.vendorCheckIn}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.vendorUnloaded}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.vendorClosed}</td>
                </tr>
                <tr style="background-color: #ffffff;">
                    <td style="position: sticky; left: 0; background: #fff; z-index: 1; padding: 8px; box-shadow: 2px 0 5px -2px #888;"><i class="fa fa-exchange"></i> TSI</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.tsiCount}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.tsiUnits}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.tsiScheduled}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.tsiArrived}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.tsiCheckIn}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.tsiUnloaded}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.tsiClosed}</td>
                </tr>
                <tr style="background-color: #f2f2f2;">
                    <td style="position: sticky; left: 0; background: #f2f2f2; z-index: 1; padding: 8px; box-shadow: 2px 0 5px -2px #888;"><i class="fa fa-cubes"></i> Parcel</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.parcelCount}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.parcelUnits}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.parcelScheduled}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.parcelArrived}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.parcelCheckIn}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.parcelUnloaded}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.parcelClosed}</td>
                </tr>
                <tr style="background-color: #ffffff;">
                    <td style="position: sticky; left: 0; background: #fff; z-index: 1; padding: 8px; box-shadow: 2px 0 5px -2px #888;"><i class="fa fa-ship"></i> Ocean</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.oceanCount}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.oceanUnits}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.oceanScheduled}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.oceanArrived}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.oceanCheckIn}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.oceanUnloaded}</td>
                    <td style="text-align: right; padding: 8px;">${summaryData.oceanClosed}</td>
                </tr>
            </table>
        `;
        if (id === 'summary-panel-early') {
            adjustLatePanelPosition();
        }
    }

    const processSlots = debounce(() => {
        const selector = targetClasses.map(cls => `div.${cls.replace(/\s+/g, '.')}`).join(', ');
        const slots = document.querySelectorAll(selector);

        let earlySummary = {
            vendorCount: 0, tsiCount: 0, vendorUnits: 0, tsiUnits: 0, totalSlots: 0, totalUnits: 0, oceanCount: 0, oceanUnits: 0, parcelCount: 0, parcelUnits: 0,
            totalScheduled: 0, totalArrived: 0, totalCheckIn: 0, totalUnloaded: 0, totalClosed: 0,
            vendorScheduled: 0, vendorArrived: 0, vendorCheckIn: 0, vendorUnloaded: 0, vendorClosed: 0,
            tsiScheduled: 0, tsiArrived: 0, tsiCheckIn: 0, tsiUnloaded: 0, tsiClosed: 0,
            parcelScheduled: 0, parcelArrived: 0, parcelCheckIn: 0, parcelUnloaded: 0, parcelClosed: 0,
            oceanScheduled: 0, oceanArrived: 0, oceanCheckIn: 0, oceanUnloaded: 0, oceanClosed: 0
        };
        let lateSummary = {
            vendorCount: 0, tsiCount: 0, vendorUnits: 0, tsiUnits: 0, totalSlots: 0, totalUnits: 0, oceanCount: 0, oceanUnits: 0, parcelCount: 0, parcelUnits: 0,
            totalScheduled: 0, totalArrived: 0, totalCheckIn: 0, totalUnloaded: 0, totalClosed: 0,
            vendorScheduled: 0, vendorArrived: 0, vendorCheckIn: 0, vendorUnloaded: 0, vendorClosed: 0,
            tsiScheduled: 0, tsiArrived: 0, tsiCheckIn: 0, tsiUnloaded: 0, tsiClosed: 0,
            parcelScheduled: 0, parcelArrived: 0, parcelCheckIn: 0, parcelUnloaded: 0, parcelClosed: 0,
            oceanScheduled: 0, oceanArrived: 0, oceanCheckIn: 0, oceanUnloaded: 0, oceanClosed: 0
        };

        slots.forEach(slot => {
            let units = 0;
            let isVendor = false, isTSI = false, isOcean = false, isParcel = false;

            const topValue = parseInt(slot.style.top.replace('px', '').trim(), 10) || 0;
            const isEarly = topValue < EARLY_THRESHOLD;

            // check class to determine the status of the slot
            const slotClass = Array.from(slot.classList).find(cls => targetClasses.includes(`appointment_slot ${cls}`)) || '';

            slot.querySelectorAll('.row').forEach(row => {
                const content = row.textContent.trim();
                if (content.startsWith('U:')) {
                    const unitValue = parseInt(content.replace('U:', '').trim(), 10);
                    if (!isNaN(unitValue)) units = unitValue;
                }
                if (content === 'MSKEU' || content === 'gdfs') isOcean = true;
            });

            slot.querySelectorAll('i').forEach(icon => {
                const iconClass = icon.className.trim();
                if (iconLegend[iconClass] === 'Vendor' && !isOcean) isVendor = true;
                if (iconLegend[iconClass] === 'TSI') isTSI = true;
                if (iconLegend[iconClass] === 'Parcel') {
                    isParcel = true;
                    units = parcelUnitEstimate;
                }
            });

            const summary = isEarly ? earlySummary : lateSummary;
            if (isVendor) { summary.vendorCount++; summary.vendorUnits += units; updateSlotCount(summary, slotClass, 'Vendor'); }
            if (isTSI) { summary.tsiCount++; summary.tsiUnits += units; updateSlotCount(summary, slotClass, 'TSI'); }
            if (isOcean) { summary.oceanCount++; summary.oceanUnits += units; updateSlotCount(summary, slotClass, 'Ocean'); }
            if (isParcel) { summary.parcelCount++; summary.parcelUnits += units; updateSlotCount(summary, slotClass, 'Parcel'); }

            if (isVendor || isTSI || isOcean || isParcel) {
                summary.totalSlots++;
                summary.totalUnits += units;
            }
        });

        updateSummaryPanel('summary-panel-early', earlySummary);
        updateSummaryPanel('summary-panel-late', lateSummary);
    }, 500);

    function observeDOMChanges() {
        observer = new MutationObserver(() => processSlots());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('load', () => {
        createSummaryPanel('summary-panel-early', 'Appointment Slot Summary Early');
        createSummaryPanel('summary-panel-late', 'Appointment Slot Summary Late');
        setTimeout(() => {
            const earlyPanel = document.getElementById('summary-panel-early');
            const latePanel = document.getElementById('summary-panel-late');
            if (earlyPanel && latePanel) {
                const rect = earlyPanel.getBoundingClientRect();
                latePanel.style.top = `${rect.bottom + 20}px`;
            }
        }, 0);
        processSlots();
        observeDOMChanges();
    });

    if (!document.getElementById('summary-panel-responsive-style')) {
        const style = document.createElement('style');
        style.id = 'summary-panel-responsive-style';
        style.textContent = `
        @media (max-width: 600px) {
            #summary-panel-early, #summary-panel-late {
                max-width: 98vw !important;
                min-width: 0 !important;
                font-size: 14px !important;
            }
        }
        `;
        document.head.appendChild(style);
    }
})();
