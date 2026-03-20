import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export const generatePDF = async (reportId: string) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10; // 10mm margin
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // Helper: temporarily force all descendants to overflow:visible
    const forceOverflowVisible = (el: HTMLElement): Map<HTMLElement, string> => {
        const saved = new Map<HTMLElement, string>();
        const all = el.querySelectorAll('*');
        all.forEach((node) => {
            const htmlNode = node as HTMLElement;
            if (htmlNode.style) {
                saved.set(htmlNode, htmlNode.style.overflow);
                htmlNode.style.overflow = 'visible';
            }
        });
        saved.set(el, el.style.overflow);
        el.style.overflow = 'visible';
        return saved;
    };

    const restoreOverflow = (saved: Map<HTMLElement, string>) => {
        saved.forEach((val, node) => {
            node.style.overflow = val;
        });
    };

    // Helper to add element to PDF
    const addElementToPdf = async (element: HTMLElement) => {
        try {
            // Force overflow visible on all children to prevent scrollbars
            const saved = forceOverflowVisible(element);

            const dataUrl = await toPng(element, {
                quality: 0.95,
                backgroundColor: '#ffffff',
                style: {
                    margin: '0',
                    overflow: 'visible',
                },
            });

            // Restore original overflow
            restoreOverflow(saved);

            const imgProps = doc.getImageProperties(dataUrl);
            const imgHeight = (imgProps.height * contentWidth) / imgProps.width;

            // Check page break
            if (yPos + imgHeight > pageHeight - margin) {
                doc.addPage();
                yPos = margin;
            }

            doc.addImage(dataUrl, 'PNG', margin, yPos, contentWidth, imgHeight);
            yPos += imgHeight + 5; // 5mm gap between sections
        } catch (error) {
            console.error('Error generating PDF section:', error);
        }
    };

    // 1. Header
    const headerElement = document.getElementById('report-header-section');
    if (headerElement) await addElementToPdf(headerElement);

    // 2. Summary Section
    const summaryElement = document.getElementById('report-summary-section');
    if (summaryElement) await addElementToPdf(summaryElement);

    // 3. Charts Section
    const chartsElement = document.getElementById('report-charts-section');
    if (chartsElement) await addElementToPdf(chartsElement);

    // 4. Detail Tables
    const detailSections = document.querySelectorAll('.report-detail-section');
    for (let i = 0; i < detailSections.length; i++) {
        const section = detailSections[i] as HTMLElement;
        await addElementToPdf(section);
    }

    doc.save(`Expense_Report_${reportId}.pdf`);
};
