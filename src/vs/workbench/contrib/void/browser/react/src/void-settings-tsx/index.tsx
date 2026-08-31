/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useRef } from 'react'
import { mountFnGenerator } from '../util/mountFnGenerator.tsx'
import { Settings } from './Settings.js'

/**
 * CocoIndex is now an internal Forge runtime capability. Older builds exposed a
 * dedicated "Code Index" settings page; keep the legacy implementation available
 * for migrations while removing it from the product-facing Settings UI.
 */
const ProductSettings = () => {
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const root = rootRef.current
		if (!root) return

		const hideLegacyCodeIndexUi = () => {
			for (const node of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
				if (node.textContent?.trim() !== 'Code Index') continue

				if (/^H[1-6]$/.test(node.tagName)) {
					const section = node.parentElement
					if (section) {
						section.style.display = 'none'
						section.setAttribute('aria-hidden', 'true')
					}
					continue
				}

				const clickable = node.closest<HTMLElement>('button, [role="button"], a')
				const navItem = clickable ?? node.parentElement ?? node
				navItem.style.display = 'none'
				navItem.setAttribute('aria-hidden', 'true')
			}
		}

		hideLegacyCodeIndexUi()
		const observer = new MutationObserver(hideLegacyCodeIndexUi)
		observer.observe(root, { childList: true, subtree: true })
		return () => observer.disconnect()
	}, [])

	return <div ref={rootRef} className='contents'><Settings /></div>
}

export const mountVoidSettings = mountFnGenerator(ProductSettings)
