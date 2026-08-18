/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useId } from 'react';

export interface ForgeBrandMarkProps {
	size?: number;
	withWordmark?: boolean;
	compact?: boolean;
	className?: string;
}

/**
 * Forge uses a geometric F / forward-path symbol: build, refine, ship.
 * The small warm ember is the human craft accent that makes the mark recognizably Forge.
 */
export const ForgeBrandMark: React.FC<ForgeBrandMarkProps> = ({
	size = 28,
	withWordmark = false,
	compact = false,
	className = '',
}) => {
	const id = useId().replace(/:/g, '');
	const gradientId = `forge-brand-gradient-${id}`;
	const glowId = `forge-brand-glow-${id}`;

	const mark = (
		<svg width={size} height={size} viewBox='0 0 32 32' role='img' aria-label='Forge' className={className}>
			<defs>
				<linearGradient id={gradientId} x1='4' y1='4' x2='28' y2='28' gradientUnits='userSpaceOnUse'>
					<stop offset='0' stopColor='#8B8DFF' />
					<stop offset='0.52' stopColor='#6D7BFF' />
					<stop offset='1' stopColor='#55D8FF' />
				</linearGradient>
				<filter id={glowId} x='-40%' y='-40%' width='180%' height='180%'>
					<feGaussianBlur stdDeviation='1.15' result='blur' />
					<feMerge><feMergeNode in='blur' /><feMergeNode in='SourceGraphic' /></feMerge>
				</filter>
			</defs>
			<rect x='2.25' y='2.25' width='27.5' height='27.5' rx='9.25' fill='#0D1628' stroke='rgba(153,164,255,0.28)' strokeWidth='1.5' />
			<path d='M9.25 22.75V10.1c0-.8.65-1.45 1.45-1.45h11.35' fill='none' stroke={`url(#${gradientId})`} strokeWidth='3.15' strokeLinecap='round' strokeLinejoin='round' filter={`url(#${glowId})`} />
			<path d='M10.8 15.55h8.95' fill='none' stroke={`url(#${gradientId})`} strokeWidth='3.15' strokeLinecap='round' filter={`url(#${glowId})`} />
			<path d='M20.15 7.8l3.15 2.3-3.15 2.3' fill='none' stroke='#8FE8FF' strokeWidth='1.55' strokeLinecap='round' strokeLinejoin='round' />
			<circle cx='23.9' cy='23.1' r='2.45' fill='#F4C668' opacity='0.12' />
			<circle cx='23.9' cy='23.1' r='1.15' fill='#F4C668' />
		</svg>
	);

	if (!withWordmark) return mark;
	return (
		<div className={`forge-brand-wordmark ${compact ? 'forge-brand-wordmark-compact' : ''}`}>
			{mark}
			<div className='forge-brand-wordmark-copy'>
				<div className='forge-brand-name'>Forge</div>
				{!compact && <div className='forge-brand-tagline'>AI engineering studio</div>}
			</div>
		</div>
	);
};
