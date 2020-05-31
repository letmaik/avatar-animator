<!-- omit in toc -->
# How to add new avatars

This process is very manual and time consuming at the moment and would benefit from some automation. If you can help with this, please open an issue to discuss what you propose or submit a Pull Request with your changes. Below are two ways you can generate a new avatar: [from scratch](#generate-from-scratch-work-in-progress) (work in progress) or [from an existing design](#generate-from-an-existing-design).

<!-- omit in toc -->
## Table of contents

- [Prerequisites](#prerequisites)
- [Generate from scratch (work in progress)](#generate-from-scratch-work-in-progress)
- [Generate from an existing design](#generate-from-an-existing-design)

## Prerequisites

- [Inkscape >= 1.0](https://inkscape.org/release/)


## Generate from scratch (work in progress)

1. Download and open the [sample skeleton SVG](resources/samples/skeleton.svg) in Inkscape and create a copy, then close sample skeleton SVG. **Note**: do not add, remove or rename joints (circles) in the group. Avatar Animator relies on these named paths to read the skeleton’s initial position. Missing joints will cause errors. You can move the joints around to embed them into your illustration. See step 4.
2. From `Object` > `Objects...` menu, create a new top level layer named `illustration`. Then place all path graphics under it. Make sure to flatten all subgroups so that the layer `illustration` only contains path elements, composite paths are not supported at the moment. The object structure should look like:
```
    [Layer 1]
    |---- skeleton
    |---- illustration
            |---- path 1
            |---- path 2
            |---- path 3
```
3. Embed the sample skeleton in `skeleton` group into your illustration by moving the joints around.
4. Save as SVG with name.
5. TODO: Open Avatar Animator and load the new SVG from the `avatar` tab.

## Generate from an existing design

1. Download and open an existing illustration from the [illustration folder](resources/illustration) in Inkscape and create a copy, then close sample skeleton SVG. **Note**: do not add, remove or rename joints (circles) in the group. Avatar Animator relies on these named paths to read the skeleton’s initial position. Missing joints will cause errors.
2. From `Object` > `Objects...` menu, expand the `illustration` layer. From here you can replace path elements with your own ones. Make sure to flatten all subgroups so that the layer `illustration` only contains path elements, composite paths are not supported at the moment. Notice that some path elements are grouped together, for example eyes, jaw, nose. Make sure to keep these groups and only replace the path elements inside these groups.
3. Save as SVG with name.
4. TODO: Open Avatar Animator and load the new SVG from the `avatar` tab.
