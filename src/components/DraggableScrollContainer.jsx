import { useState, useRef } from 'react';

const DraggableScrollContainer = ({ children, className, style }) => {
    const ref = useRef(null);
    const [isDown, setIsDown] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const onMouseDown = (e) => {
        setIsDown(true);
        setStartX(e.pageX - ref.current.offsetLeft);
        setScrollLeft(ref.current.scrollLeft);
        if (ref.current) ref.current.style.scrollBehavior = 'auto';
        setIsDragging(false);
    };

    const onMouseLeave = () => {
        setIsDown(false);
        setIsDragging(false);
        if (ref.current) ref.current.style.scrollBehavior = 'smooth';
    };

    const onMouseUp = (e) => {
        setIsDown(false);
        if (ref.current) ref.current.style.scrollBehavior = 'smooth';
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const onMouseMove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - ref.current.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > 5) {
            setIsDragging(true);
        }
        ref.current.scrollLeft = scrollLeft - walk;
    };

    const onClickCapture = (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <div
            ref={ref}
            className={`${className} cursor-grab active:cursor-grabbing`}
            style={style}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            onClickCapture={onClickCapture}
        >
            {children}
        </div>
    );
};

export default DraggableScrollContainer;
