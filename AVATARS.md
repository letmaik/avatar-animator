<!-- omit in toc -->
# How to add new avatars

This process is very manual and time consuming at the moment and would benefit from some automation. If you can help with this, please open an issue to discuss what you propose or submit a Pull Request with your changes. You can create a new avatar [from scratch](#create-a-new-avatar-from-scratch-work-in-progress) (work in progress) or by [modifying an existing design](#create-a-new-avatar-by-modifying-an-existing-design).

<!-- omit in toc -->
## Table of contents

- [Prerequisites](#prerequisites)
- [Create a new avatar from scratch (work in progress)](#create-a-new-avatar-from-scratch-work-in-progress)
- [Create a new avatar by modifying an existing design](#create-a-new-avatar-by-modifying-an-existing-design)


## Prerequisites

- [Inkscape >= 1.0](https://inkscape.org/release/)


## Create a new avatar from scratch (work in progress)

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
4. Save as SVG with your preferred name.
5. TODO: Open Avatar Animator and load the new SVG from the `avatar` tab.


## Create a new avatar by modifying an existing design

1. Download and open an existing illustration from the [illustration folder](resources/illustration) in Inkscape and create a copy, then close sample skeleton SVG. **Note**: do not add, remove or rename joints (circles) in the group. Avatar Animator relies on these named paths to read the skeleton’s initial position. Missing joints will cause errors.
2. From `Object` > `Objects...` menu, expand the `illustration` layer. From here you can replace path elements with your own ones. Make sure to flatten all subgroups so that the layer `illustration` only contains path elements, composite paths are not supported at the moment. Notice that some path elements are grouped together, for example eyes, jaw, nose. Make sure to keep these groups and only replace the path elements inside these groups.
3. Save as SVG with your preferred name.
4. TODO: Open Avatar Animator and load the new SVG from the `avatar` tab.
