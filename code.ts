figma.parameters.on('input', (parameters: ParameterValues, currentKey: string, result: SuggestionResults) => {
	const query = parameters[currentKey]
	switch (currentKey) {
		case 'color':
			const colors = ['Gray', 'Black', 'White']
			result.setSuggestions(colors.filter(s => s.includes(query)))
			break
		default:
			return
	}
});
figma.on('run', ({
	parameters
}: RunEvent) => {
	0 === figma.currentPage.selection.length && (figma.notify("Select at least one item."), figma.closePlugin());
	if (parameters) {
		let color;
		"Gray" === parameters.color && (color = {
				r: .9,
				g: .9,
				b: .9
			}),
			"Black" === parameters.color && (color = {
				r: 0,
				g: 0,
				b: 0
			}),
			"White" === parameters.color && (color = {
				r: 1,
				g: 1,
				b: 1
			});
		let all = new Array();
		const traversal = (e, f) => {
			let count = 0;

			function* read(nodes) {
				const len = nodes.length;
				if (len === 0) {
					return;
				}
				for (let i = 0; i < len; i++) {
					const node = nodes[i];
					yield node;
					let children = node.children;
					if (children) {
						yield* read(children);
					}
				}
				f.push(nodes);
			}
			const it = read(e);
			let res = it.next();
			while (!res.done) {
				count++;
				res = it.next();
			}
		}
		traversal(figma.currentPage.selection, all);
		all = all.flat();
		let instances = all.filter(n => n.type === 'INSTANCE').filter(n => n.id.substr(0, 1) !== "I") as InstanceNode[];;
		if (instances.length > 0) {
			let [a, e, t, l] = [new Array, new Array, new Array, new Array];
			instances.map(e => a.push(e.detachInstance())), traversal(a, e), e.flat().filter(a => "INSTANCE" === a.type).map(a => t.push(a.detachInstance())), traversal(a, l), (l = l.flat()).filter(a => "FRAME" === a.type).map(a => a.layoutMode = "NONE"), all = all.concat(l).flat()
		}
		all = all.filter(n => n.id.substr(0, 1) !== "I").filter(n => n.type !== "INSTANCE")
		let frames = all.filter(n => n.type === "FRAME" && n.parent.type !== 'PAGE') as FrameNode[];
		let shapes = all.filter(
			n =>
			n.type === 'ELLIPSE' ||
			n.type === 'POLYGON' ||
			n.type === 'RECTANGLE' ||
			n.type === 'STAR'
		) as SceneNode[];
		let vectors = all.filter(n => n.type === 'VECTOR') as VectorNode[];
		let text = all.filter(n => n.type === "TEXT") as TextNode[];
		const ghostifyFrames = o => {
			o.map(o => {
				o.effects = [{
					type: "DROP_SHADOW",
					color: {
						r: 0,
						g: 0,
						b: 0,
						a: 0
					},
					offset: {
						x: 0,
						y: 2
					},
					radius: 0,
					spread: 0,
					visible: !0,
					blendMode: "NORMAL",
					showShadowBehindNode: !0
				}], o.fills = [{
					type: "SOLID",
					opacity: 0,
					color: color
				}], o.strokeWeight = 0, o.strokes = [{
					type: "SOLID",
					opacity: 0,
					color: color
				}], o.strokeWeight = 0
			})
		};
		ghostifyFrames(frames);
		const ghostifyVector = o => {
			o.map(o => {
				o.resizeWithoutConstraints(o.width, o.height), o.x = o.relativeTransform[0][2], o.y = o.relativeTransform[1][2], o.fills = [{
					type: "SOLID",
					color: color
				}], o.strokes = [{
					type: "SOLID",
					color: color
				}]
			})
		};
		ghostifyVector(vectors);
		const ghostifyShapes = (n) => {
			const nodes: SceneNode[] = [];
			n.map(e => {
				const t = figma.createRectangle();
				"ELLIPSE" === e.type && (t.cornerRadius = 1e3), t.resizeWithoutConstraints(e.width, e.height), t.x = e.relativeTransform[0][2], t.y = e.relativeTransform[1][2], t.fills = [{
					type: "SOLID",
					color: color
				}], nodes.push(t), "COMPONENT_SET" !== e.parent.type && "PAGE" !== e.parent.type && (e.parent.insertChild(e.parent.children.length, t), e.remove())
			});
		}
		ghostifyShapes(shapes);
		const ghostifyText = (n) => {
			n.map((e) => {
				let fontsize = Number(e.fontSize),
					height = e.height,
					lineHeight = e.lineHeight;
				isNaN(lineHeight) && (lineHeight = 1.25 * fontsize);
				const nodes: SceneNode[] = [],
					numberOfRectangles = Math.round(height / lineHeight);
				for (let t = 0; t < numberOfRectangles; t++) {
					const i = figma.createRectangle();
					i.resizeWithoutConstraints((e.width, e.width), .7 * lineHeight), i.cornerRadius = lineHeight, i.x = e.relativeTransform[0][2], i.y = e.relativeTransform[1][2] + lineHeight * t, i.fills = [{
						type: "SOLID",
						color: color
					}], nodes.push(i), e.parent.insertChild(e.parent.children.length, i)
				}
				e.remove();
			});
		};
		ghostifyText(text);
		const nest = () => {
			const nest = Array.from(
				figma.currentPage.findAll(
					(item) => item.parent.type === 'PAGE',
				) as SceneNode[],
			);
			const topframes = Array.from(
				figma.currentPage.findAll(
					(frame) => frame.type === 'FRAME' && frame.parent.type === 'PAGE',
				) as FrameNode[],
			);
			frames.map(e => e.layoutMode = 'NONE')
			0 != topframes.length &&
				0 != nest.length &&
				nest.map((a) => {
					topframes.map((e) => {
						if (!0 === overlap(a, e) && a.id != e.id) {
							let t = Math.abs(e.x - a.x),
								h = Math.abs(e.y - a.y);
							e.appendChild(a), (a.x = t), (a.y = h);
						}
					});
				});

			function overlap(e, h) {
				return (
					e.parent.children.indexOf(e) > h.parent.children.indexOf(h) &&
					e.x >= h.x &&
					e.x + e.width <= h.x + h.width &&
					e.y >= h.y &&
					e.y + e.height <= h.y + h.height
				);

			}
		};
		nest();
		figma.closePlugin('ghostified');
	}
});